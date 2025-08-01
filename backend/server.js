const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

const app = express();

// Enhanced CORS configuration for Render Docker
const corsOptions = {
  origin: [
    'https://ceople-main.vercel.app',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ceople-main.vercel.app/',
    'https://ceople-main.vercel.app/*'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Create server first
const server = http.createServer(app);

// Enhanced Socket.IO configuration for Render Docker
const io = socketIo(server, {
  cors: {
    origin: [
      'https://ceople-main.vercel.app',
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173',
      'https://ceople-main.vercel.app/',
      'https://ceople-main.vercel.app/*'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store active users and rooms
const activeUsers = new Map();
const waitingUsers = new Map();

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const guestUsername = socket.handshake.auth.guestUsername;
    if (!token) {
      // Allow guest/anonymous users
      if (guestUsername) {
        socket.userId = 'guest-' + Math.random().toString(36).slice(2);
        socket.user = { id: socket.userId, username: guestUsername, isGuest: true };
        console.log('Socket.IO guest auth:', socket.userId, guestUsername);
        return next();
      } else {
        console.log('Socket.IO auth error: No token or guestUsername provided');
        return next(new Error('Authentication error: No token or guestUsername provided'));
      }
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Socket.IO auth error:', error?.message || 'Invalid token');
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.userId = user.id;
    socket.user = user;
    console.log('Socket.IO auth successful for user:', user.id);
    next();
  } catch (error) {
    console.log('Socket.IO auth error:', error.message);
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  try {
    console.log('User connected:', socket.userId);
    activeUsers.set(socket.userId, socket);
  } catch (error) {
    console.error('❌ Error in socket connection:', error);
  }

  // Join queue event
  socket.on('join-queue', async (data) => {
    try {
      console.log('join-queue event received', data, 'user:', socket.userId);
      
      const { chatType = 'video' } = data;
      
      if (socket.user && socket.user.isGuest) {
        // For guests, just add to waitingUsers (no DB)
        console.log('👤 Adding guest user to waiting queue:', socket.userId, 'chatType:', chatType);
        waitingUsers.set(socket.userId, { chatType, socket });
        console.log('📊 Current waiting users:', Array.from(waitingUsers.keys()));
        await findMatch(socket.userId, chatType);
        return;
      }

      // Remove user from any existing queue entry
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', socket.userId);

      // Add user to queue
      const { error: queueError } = await supabase
        .from('user_queue')
        .insert({
          user_id: socket.userId,
          chat_type: chatType
        });

      if (queueError) {
        console.error('Error adding to queue:', queueError);
        socket.emit('error', { message: 'Failed to join queue' });
        return;
      }

      waitingUsers.set(socket.userId, { chatType, socket });
      
      // Try to find a match
      await findMatch(socket.userId, chatType);
      
    } catch (error) {
      console.error('❌ Error in join-queue:', error);
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // Send message event
  socket.on('send-message', async (data) => {
    try {
      const { roomId, message, messageType = 'text' } = data;
      
      if (socket.user && socket.user.isGuest) {
        // For guests, just broadcast (don't save to DB)
        socket.to(roomId).emit('new-message', {
          roomId,
          senderId: socket.userId,
          content: message,
          messageType,
        });
        return;
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          user_id: socket.userId,
          content: message,
          message_type: messageType
        });

      if (error) {
        console.error('Error saving message:', error);
        return;
      }

      // Broadcast message to room
      socket.to(roomId).emit('new-message', {
        roomId,
        senderId: socket.userId,
        content: message,
        messageType,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in send-message:', error);
    }
  });

  // WebRTC signaling
  socket.on('webrtc-signal', (data) => {
    try {
      const { roomId, signal, targetUserId } = data;
      console.log('📡 WebRTC signal received:', signal.type, 'from user:', socket.userId, 'to room:', roomId);
      
      // Broadcast to other users in the room
      socket.to(roomId).emit('webrtc-signal', {
        signal,
        fromUserId: socket.userId,
        targetUserId
      });
      
      console.log('📡 WebRTC signal relayed to room:', roomId);
    } catch (error) {
      console.error('❌ Error handling WebRTC signal:', error);
    }
  });

  // Test ping-pong for WebRTC
  socket.on('webrtc-ping', (data) => {
    try {
      const { roomId } = data;
      console.log('🏓 WebRTC ping from user:', socket.userId, 'to room:', roomId);
      
      socket.to(roomId).emit('webrtc-pong', {
        fromUserId: socket.userId,
        roomId
      });
      
      console.log('🏓 WebRTC pong sent to room:', roomId);
    } catch (error) {
      console.error('❌ Error handling WebRTC ping:', error);
    }
  });

  // Leave room event
  socket.on('leave-room', async (data) => {
    try {
      const { roomId } = data;
      
      // Update room status
      await supabase
        .from('chat_rooms')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', roomId);

      // Remove participants
      await supabase
        .from('chat_participants')
        .delete()
        .eq('room_id', roomId);

      // Notify other user
      socket.to(roomId).emit('user-left', { roomId });
      
      // Leave socket room
      socket.leave(roomId);
      
    } catch (error) {
      console.error('Error in leave-room:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.userId);
    
    // Remove from active users
    activeUsers.delete(socket.userId);
    waitingUsers.delete(socket.userId);
    
    // Remove from queue
    try {
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', socket.userId);
    } catch (error) {
      console.error('Error removing from queue on disconnect:', error);
    }
  });
});

// Find match function
async function findMatch(userId, chatType) {
  try {
    // Check if user is a guest
    const isGuest = userId.startsWith('guest-');
    
    if (isGuest) {
      // For guest users, use in-memory matching
      console.log('🔍 Looking for guest match for:', userId, 'chatType:', chatType);
      console.log('📊 Available waiting users:', Array.from(waitingUsers.entries()).map(([id, data]) => ({ id, chatType: data.chatType })));
      
      const waitingUser = Array.from(waitingUsers.entries())
        .find(([id, data]) => 
          id !== userId && 
          data.chatType === chatType && 
          id.startsWith('guest-')
        );
      
      if (!waitingUser) {
        console.log('No guest match found for user:', userId);
        return;
      }
      
      const otherUserId = waitingUser[0];
      const roomId = 'room-' + Math.random().toString(36).slice(2);
      
      // Notify both users
      const userSocket = activeUsers.get(userId);
      const otherUserSocket = activeUsers.get(otherUserId);

      if (userSocket) {
        userSocket.join(roomId);
        userSocket.emit('match-found', { roomId, chatType, isInitiator: true });
      }

      if (otherUserSocket) {
        otherUserSocket.join(roomId);
        otherUserSocket.emit('match-found', { roomId, chatType, isInitiator: false });
      }

      // Remove from waiting users
      waitingUsers.delete(userId);
      waitingUsers.delete(otherUserId);

      console.log('Guest match created:', roomId, 'between', userId, 'and', otherUserId);
      return;
    }

    // For authenticated users, use database
    const { data: waitingUser, error } = await supabase
      .from('user_queue')
      .select('user_id')
      .eq('chat_type', chatType)
      .neq('user_id', userId)
      .limit(1)
      .single();

    if (error || !waitingUser) {
      console.log('No match found for user:', userId);
      return;
    }

    const otherUserId = waitingUser.user_id;

    // Create chat room
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (roomError) {
      console.error('Error creating room:', roomError);
      return;
    }

    const roomId = room.id;

    // Add participants
    const { error: participantsError } = await supabase
      .from('chat_participants')
      .insert([
        { room_id: roomId, user_id: userId },
        { room_id: roomId, user_id: otherUserId }
      ]);

    if (participantsError) {
      console.error('Error adding participants:', participantsError);
      return;
    }

    // Remove both users from queue
    await supabase
      .from('user_queue')
      .delete()
      .in('user_id', [userId, otherUserId]);

    // Notify both users
    const userSocket = activeUsers.get(userId);
    const otherUserSocket = activeUsers.get(otherUserId);

    if (userSocket) {
      userSocket.join(roomId);
      userSocket.emit('match-found', { roomId, chatType, isInitiator: true });
    }

    if (otherUserSocket) {
      otherUserSocket.join(roomId);
      otherUserSocket.emit('match-found', { roomId, chatType, isInitiator: false });
    }

    // Remove from waiting users
    waitingUsers.delete(userId);
    waitingUsers.delete(otherUserId);

    console.log('Match created:', roomId, 'between', userId, 'and', otherUserId);

  } catch (error) {
    console.error('Error in findMatch:', error);
  }
}

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/socket.io/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString() 
  });
});

// API endpoint to get room messages
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Optimize for production
if (process.env.NODE_ENV === 'production') {
  // Reduce memory usage
  server.maxConnections = 100;
  
  // Set keep-alive timeout
  server.keepAliveTimeout = 30000;
  server.headersTimeout = 35000;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Supabase URL: ${supabaseUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🔑 Supabase Key: ${supabaseServiceKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`📡 Socket.IO transports: polling, websocket`);
  console.log(`🌐 CORS origins: ${corsOptions.origin.join(', ')}`);
  console.log(`⏰ Server started at: ${new Date().toISOString()}`);
  console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error('⚠️ Port is already in use. Retrying in 5 seconds...');
    setTimeout(() => {
      server.listen(PORT, '0.0.0.0');
    }, 5000);
  }
});

// Add startup delay for stability
setTimeout(() => {
  console.log('✅ Server startup completed successfully');
}, 2000); 