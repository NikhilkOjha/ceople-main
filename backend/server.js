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

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API endpoint to submit feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const { rating, userId, roomId, chatType } = req.body;
    
    if (!rating || !['positive', 'negative'].includes(rating)) {
      return res.status(400).json({ error: 'Invalid rating. Must be "positive" or "negative"' });
    }

    const { error } = await supabase
      .from('feedback')
      .insert({
        rating,
        user_id: userId || null,
        room_id: roomId || null,
        chat_type: chatType || 'unknown',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving feedback:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error in feedback endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get feedback statistics
app.get('/api/feedback/stats', async (req, res) => {
  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error getting total count:', totalError);
      return res.status(500).json({ error: totalError.message });
    }

    // Get positive count
    const { count: positiveCount, error: positiveError } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('rating', 'positive');

    if (positiveError) {
      console.error('Error getting positive count:', positiveError);
      return res.status(500).json({ error: positiveError.message });
    }

    // Get negative count
    const { count: negativeCount, error: negativeError } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('rating', 'negative');

    if (negativeError) {
      console.error('Error getting negative count:', negativeError);
      return res.status(500).json({ error: negativeError.message });
    }

    const total = totalCount || 0;
    const positive = positiveCount || 0;
    const negative = negativeCount || 0;
    const positivePercentage = total > 0 ? (positive / total) * 100 : 0;
    const negativePercentage = total > 0 ? (negative / total) * 100 : 0;

    res.json({
      total,
      positive,
      negative,
      positivePercentage,
      negativePercentage
    });
  } catch (error) {
    console.error('Error in feedback stats endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to submit email signup
app.post('/api/email-signup', async (req, res) => {
  try {
    const { email, source = 'website' } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const { error } = await supabase
      .from('email_signups')
      .insert({
        email: email.toLowerCase().trim(),
        source
      });

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Email already subscribed' });
      }
      console.error('Error saving email signup:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: 'Email subscribed successfully' });
  } catch (error) {
    console.error('Error in email signup endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get email signup statistics
app.get('/api/email-signups/stats', async (req, res) => {
  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('email_signups')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error getting total count:', totalError);
      return res.status(500).json({ error: totalError.message });
    }

    // Get recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentCount, error: recentError } = await supabase
      .from('email_signups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentError) {
      console.error('Error getting recent count:', recentError);
      return res.status(500).json({ error: recentError.message });
    }

    // Get signups by source
    const { data: sourceData, error: sourceError } = await supabase
      .from('email_signups')
      .select('source, count')
      .select('source')
      .order('created_at', { ascending: false });

    if (sourceError) {
      console.error('Error getting source data:', sourceError);
      return res.status(500).json({ error: sourceError.message });
    }

    // Group by source
    const sourceStats = sourceData.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total: totalCount || 0,
      recent: recentCount || 0,
      sourceStats
    });
  } catch (error) {
    console.error('Error in email signups stats endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get chat sessions statistics
app.get('/api/chat-sessions/stats', async (req, res) => {
  try {
    // Get total chat rooms created
    const { count: totalRooms, error: totalError } = await supabase
      .from('chat_rooms')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error getting total rooms:', totalError);
      return res.status(500).json({ error: totalError.message });
    }

    // Get active chat rooms
    const { count: activeRooms, error: activeError } = await supabase
      .from('chat_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (activeError) {
      console.error('Error getting active rooms:', activeError);
      return res.status(500).json({ error: activeError.message });
    }

    // Get recent chat rooms (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentRooms, error: recentError } = await supabase
      .from('chat_rooms')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentError) {
      console.error('Error getting recent rooms:', recentError);
      return res.status(500).json({ error: recentError.message });
    }

    // Get total participants
    const { count: totalParticipants, error: participantsError } = await supabase
      .from('chat_participants')
      .select('*', { count: 'exact', head: true });

    if (participantsError) {
      console.error('Error getting participants:', participantsError);
      return res.status(500).json({ error: participantsError.message });
    }

    res.json({
      totalRooms: totalRooms || 0,
      activeRooms: activeRooms || 0,
      recentRooms: recentRooms || 0,
      totalParticipants: totalParticipants || 0
    });
  } catch (error) {
    console.error('Error in chat sessions stats endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get user location statistics
app.get('/api/user-locations/stats', async (req, res) => {
  try {
    // Get total locations
    const { count: totalLocations, error: totalError } = await supabase
      .from('user_locations')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error getting total locations:', totalError);
      return res.status(500).json({ error: totalError.message });
    }

    // Get unique countries
    const { data: countryData, error: countryError } = await supabase
      .from('user_locations')
      .select('country')
      .not('country', 'is', null);

    if (countryError) {
      console.error('Error getting country data:', countryError);
      return res.status(500).json({ error: countryError.message });
    }

    // Group by country
    const countryStats = countryData.reduce((acc, item) => {
      acc[item.country] = (acc[item.country] || 0) + 1;
      return acc;
    }, {});

    // Get top 10 countries
    const topCountries = Object.entries(countryStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    res.json({
      totalLocations: totalLocations || 0,
      uniqueCountries: Object.keys(countryStats).length,
      topCountries,
      countryStats
    });
  } catch (error) {
    console.error('Error in user locations stats endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to submit user location
app.post('/api/user-location', async (req, res) => {
  try {
    const { userId, ipAddress, locationData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { error } = await supabase
      .from('user_locations')
      .insert({
        user_id: userId,
        ip_address: ipAddress,
        country: locationData?.country,
        region: locationData?.region,
        city: locationData?.city,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        timezone: locationData?.timezone,
        user_agent: req.headers['user-agent']
      });

    if (error) {
      console.error('Error saving user location:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: 'Location saved successfully' });
  } catch (error) {
    console.error('Error in user location endpoint:', error);
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