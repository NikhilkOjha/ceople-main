const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["https://ceople-main.vercel.app", "http://localhost:8080", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    transports: ['polling', 'websocket']
  },
  allowEIO3: true,
  transports: ['polling', 'websocket']
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || "https://arluwakftvvbioprdsmw.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "your-service-key"
);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS middleware
app.use(cors({
  origin: ["https://ceople-main.vercel.app", "http://localhost:8080", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Preflight handler for Socket.IO
app.options('/socket.io/*', cors({
  origin: ["https://ceople-main.vercel.app", "http://localhost:8080", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Add CORS headers for all Socket.IO routes
app.use('/socket.io/*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://ceople-main.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());

// Chat room management
const chatRooms = new Map();
const userSessions = new Map();

// Authentication middleware
const authenticateUser = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Authentication error'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

io.use(authenticateUser);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.id}`);
  console.log(`Socket transport: ${socket.conn.transport.name}`);
  console.log(`Socket headers:`, socket.handshake.headers);

  // Join chat queue
  socket.on('join-queue', async (data) => {
    try {
      const { chatType = 'both' } = data;
      
      // Remove user from any existing queue
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', socket.user.id);

      // Add user to queue
      await supabase
        .from('user_queue')
        .insert({
          user_id: socket.user.id,
          chat_type: chatType,
          interests: []
        });

      // Try to find a match
      await findMatch(socket, chatType);
    } catch (error) {
      console.error('Error joining queue:', error);
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const { roomId, content } = data;
      
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          user_id: socket.user.id,
          content,
          message_type: 'text'
        });

      if (error) throw error;

      // Broadcast message to room
      socket.to(roomId).emit('new-message', {
        id: uuidv4(),
        room_id: roomId,
        user_id: socket.user.id,
        content,
        message_type: 'text',
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // WebRTC signaling
  socket.on('webrtc-signal', (data) => {
    const { roomId, signal, targetUserId } = data;
    socket.to(roomId).emit('webrtc-signal', {
      signal,
      fromUserId: socket.user.id,
      targetUserId
    });
  });

  // Leave room
  socket.on('leave-room', async (data) => {
    try {
      const { roomId } = data;
      
      // Update participant status
      await supabase
        .from('chat_participants')
        .update({ 
          is_active: false,
          left_at: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('user_id', socket.user.id);

      // Update room status
      await supabase
        .from('chat_rooms')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', roomId);

      // Remove from queue
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', socket.user.id);

      socket.leave(roomId);
      socket.emit('room-left', { roomId });
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.user.id}`);
    
    try {
      // Clean up user from queue
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', socket.user.id);
    } catch (error) {
      console.error('Error cleaning up user:', error);
    }
  });
});

// Find match for user
async function findMatch(socket, chatType) {
  try {
    // Look for waiting users with compatible chat type
    const { data: waitingUsers } = await supabase
      .from('user_queue')
      .select('*')
      .neq('user_id', socket.user.id)
      .in('chat_type', [chatType, 'both'])
      .limit(1);

    if (waitingUsers && waitingUsers.length > 0) {
      const matchedUser = waitingUsers[0];
      
      // Create chat room
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ status: 'active' })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add both users as participants
      await supabase
        .from('chat_participants')
        .insert([
          {
            room_id: room.id,
            user_id: socket.user.id
          },
          {
            room_id: room.id,
            user_id: matchedUser.user_id
          }
        ]);

      // Remove both users from queue
      await supabase
        .from('user_queue')
        .delete()
        .in('user_id', [socket.user.id, matchedUser.user_id]);

      // Join both users to the room
      socket.join(room.id);
      
      // Notify both users about the match
      socket.emit('match-found', { roomId: room.id });
      io.to(matchedUser.user_id).emit('match-found', { roomId: room.id });
    } else {
      // No match found, wait for one
      socket.emit('waiting-for-match');
    }
  } catch (error) {
    console.error('Error finding match:', error);
    socket.emit('error', { message: 'Failed to find match' });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'https://ceople-main.vercel.app'
  });
});

// Socket.IO health check
app.get('/socket.io/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    socketIO: 'running',
    timestamp: new Date().toISOString()
  });
});

// API endpoints
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'https://ceople-main.vercel.app'}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL || 'Not set'}`);
}); 