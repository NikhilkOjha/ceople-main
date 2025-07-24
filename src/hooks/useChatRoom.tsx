import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../integrations/supabase/client';

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image';
  timestamp: string;
}

interface ChatRoomState {
  isConnected: boolean;
  isInQueue: boolean;
  isInRoom: boolean;
  roomId: string | null;
  messages: Message[];
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  error: string | null;
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://ceople-backend-docker.onrender.com';

export const useChatRoom = () => {
  const [state, setState] = useState<ChatRoomState>({
    isConnected: false,
    isInQueue: false,
    isInRoom: false,
    roomId: null,
    messages: [],
    remoteStream: null,
    localStream: null,
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,
    error: null
  });

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Initialize Socket.IO connection
  const initializeSocket = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token');
      }

      const socket = io(BACKEND_URL, {
        auth: {
          token: session.access_token
        },
        transports: ['websocket', 'polling'], // Allow both WebSocket and polling
        timeout: 20000,
        forceNew: true
      });

      socket.on('connect', () => {
        console.log('Connected to backend');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from backend');
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isInQueue: false, 
          isInRoom: false 
        }));
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setState(prev => ({ ...prev, error: 'Failed to connect to server' }));
      });

      socket.on('match-found', (data) => {
        console.log('Match found:', data);
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          isInRoom: true, 
          roomId: data.roomId 
        }));
        initializeWebRTC();
      });

      socket.on('new-message', (message) => {
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, message]
        }));
      });

      socket.on('webrtc-signal', (data) => {
        handleWebRTCSignal(data);
      });

      socket.on('user-left', (data) => {
        console.log('User left:', data);
        setState(prev => ({ 
          ...prev, 
          isInRoom: false, 
          roomId: null,
          remoteStream: null 
        }));
        cleanupWebRTC();
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setState(prev => ({ ...prev, error: error.message }));
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('Error initializing socket:', error);
      setState(prev => ({ ...prev, error: 'Failed to initialize connection' }));
    }
  }, []);

  // Join queue
  const joinQueue = useCallback(async (chatType: 'video' | 'text' = 'video') => {
    if (!socketRef.current?.connected) {
      await initializeSocket();
    }

    if (socketRef.current) {
      socketRef.current.emit('join-queue', { chatType });
      setState(prev => ({ ...prev, isInQueue: true, error: null }));
    }
  }, [initializeSocket]);

  // Send message
  const sendMessage = useCallback((message: string, messageType: 'text' | 'image' = 'text') => {
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('send-message', {
        roomId: state.roomId,
        message,
        messageType
      });
    }
  }, [state.roomId]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('leave-room', { roomId: state.roomId });
    }
    setState(prev => ({ 
      ...prev, 
      isInRoom: false, 
      isInQueue: false, 
      roomId: null,
      messages: [],
      remoteStream: null 
    }));
    cleanupWebRTC();
  }, [state.roomId]);

  // Initialize WebRTC
  const initializeWebRTC = useCallback(async () => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      setState(prev => ({ ...prev, localStream: stream }));

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(track, stream);
        }
      });

      // Handle incoming streams
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Received remote stream');
        setState(prev => ({ ...prev, remoteStream: event.streams[0] }));
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc-signal', {
            roomId: state.roomId,
            signal: { type: 'ice-candidate', candidate: event.candidate },
            targetUserId: null
          });
        }
      };

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('webrtc-signal', {
          roomId: state.roomId,
          signal: { type: 'offer', sdp: offer },
          targetUserId: null
        });
      }
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      setState(prev => ({ ...prev, error: 'Failed to access camera/microphone' }));
    }
  }, [state.roomId]);

  // Handle WebRTC signaling
  const handleWebRTCSignal = useCallback(async (data: any) => {
    if (!peerConnectionRef.current) return;

    try {
      const { signal } = data;

      if (signal.type === 'offer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        if (socketRef.current) {
          socketRef.current.emit('webrtc-signal', {
            roomId: state.roomId,
            signal: { type: 'answer', sdp: answer },
            targetUserId: null
          });
        }
      } else if (signal.type === 'answer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate') {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
    }
  }, [state.roomId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setState(prev => ({ ...prev, isVideoEnabled: videoTrack.enabled }));
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState(prev => ({ ...prev, isAudioEnabled: audioTrack.enabled }));
      }
    }
  }, []);

  // Toggle screen sharing
  const toggleScreenSharing = useCallback(async () => {
    try {
      if (!state.isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => 
            s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }

        setState(prev => ({ ...prev, isScreenSharing: true }));
      } else {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        if (localStreamRef.current && peerConnectionRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => 
            s.track?.kind === 'video'
          );
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        }

        setState(prev => ({ ...prev, isScreenSharing: false }));
      }
    } catch (error) {
      console.error('Error toggling screen sharing:', error);
    }
  }, [state.isScreenSharing]);

  // Cleanup WebRTC
  const cleanupWebRTC = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      localStream: null, 
      remoteStream: null,
      isScreenSharing: false 
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanupWebRTC();
    };
  }, [cleanupWebRTC]);

  return {
    ...state,
    joinQueue,
    sendMessage,
    leaveRoom,
    toggleVideo,
    toggleAudio,
    toggleScreenSharing
  };
};