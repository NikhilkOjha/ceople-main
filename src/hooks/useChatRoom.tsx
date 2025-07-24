import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ChatRoom {
  id: string;
  status: 'waiting' | 'active' | 'ended';
  created_at: string;
}

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'system' | 'emoji';
  created_at: string;
}

interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  is_active: boolean;
}

export const useChatRoom = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isInQueue, setIsInQueue] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize WebRTC
  const initializeWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection with better ICE servers
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          toast({
            title: "Connected!",
            description: "Video chat connection established successfully.",
          });
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          toast({
            title: "Connection Lost",
            description: "Video chat connection was lost. Trying to reconnect...",
            variant: "destructive",
          });
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && currentRoom && socketRef.current) {
          socketRef.current.emit('webrtc-signal', {
            roomId: currentRoom.id,
            signal: { type: 'ice-candidate', candidate: event.candidate },
            targetUserId: null // Broadcast to all in room
          });
        }
      };

      peerConnectionRef.current = pc;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      toast({
        title: "Camera/Microphone Error",
        description: "Please allow camera and microphone access to use video chat.",
        variant: "destructive",
      });
    }
  };

  // Initialize Socket.IO connection
  const initializeSocket = useCallback(async () => {
    if (!user) return;

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session token');
      }

      // Connect to backend
      const socket = io(process.env.REACT_APP_BACKEND_URL || 'https://ceople-backend.onrender.com', {
        auth: {
          token: session.access_token
        }
      });

      socket.on('connect', () => {
        console.log('Connected to backend');
      });

      socket.on('match-found', async (data) => {
        const { roomId } = data;
        setCurrentRoom({ id: roomId, status: 'active', created_at: new Date().toISOString() });
        setIsInQueue(false);
        setIsConnecting(false);

        // Initialize WebRTC for video chat
        await initializeWebRTC();

        toast({
          title: "Match Found!",
          description: "You've been connected with a stranger.",
        });
      });

      socket.on('waiting-for-match', () => {
        setIsInQueue(true);
        setIsConnecting(false);
      });

      socket.on('new-message', (message: Message) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('webrtc-signal', async (data) => {
        const { signal, fromUserId } = data;
        
        if (fromUserId === user?.id || !peerConnectionRef.current) return;

        try {
          if (signal.type === 'offer') {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            
            socket.emit('webrtc-signal', {
              roomId: currentRoom?.id,
              signal: answer,
              targetUserId: fromUserId
            });
          } else if (signal.type === 'answer') {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          } else if (signal.type === 'ice-candidate') {
            await peerConnectionRef.current.addIceCandidate(signal.candidate);
          }
        } catch (error) {
          console.error('Error handling WebRTC signal:', error);
        }
      });

      socket.on('room-left', (data) => {
        const { roomId } = data;
        if (currentRoom?.id === roomId) {
          leaveRoom();
        }
      });

      socket.on('error', (error) => {
        toast({
          title: "Connection Error",
          description: error.message,
          variant: "destructive",
        });
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('Error initializing socket:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server.",
        variant: "destructive",
      });
    }
  }, [user, currentRoom, toast]);

  // Join queue for matching
  const joinQueue = async (chatType: 'video' | 'text' | 'both' = 'both') => {
    if (!user || !socketRef.current) return;

    setIsConnecting(true);
    setIsInQueue(true);

    try {
      socketRef.current.emit('join-queue', { chatType });
    } catch (error) {
      console.error('Error joining queue:', error);
      toast({
        title: "Connection Error",
        description: "Failed to join the chat queue. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
      setIsInQueue(false);
    }
  };

  // Send text message
  const sendMessage = async (content: string) => {
    if (!currentRoom || !user || !content.trim() || !socketRef.current) return;

    try {
      socketRef.current.emit('send-message', {
        roomId: currentRoom.id,
        content: content.trim()
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Message Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Leave current room
  const leaveRoom = async () => {
    if (!user) return;

    try {
      if (socketRef.current && currentRoom) {
        socketRef.current.emit('leave-room', { roomId: currentRoom.id });
      }

      // Clean up WebRTC
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      setCurrentRoom(null);
      setMessages([]);
      setParticipants([]);
      setIsInQueue(false);
      setIsConnecting(false);

    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  // Find next stranger
  const findNext = async () => {
    await leaveRoom();
    await joinQueue();
  };

  // Initialize socket connection
  useEffect(() => {
    initializeSocket();
  }, [initializeSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    currentRoom,
    messages,
    participants,
    isInQueue,
    isConnecting,
    isVideoEnabled,
    isAudioEnabled,
    localVideoRef,
    remoteVideoRef,
    joinQueue,
    sendMessage,
    leaveRoom,
    findNext,
    toggleVideo,
    toggleAudio
  };
};