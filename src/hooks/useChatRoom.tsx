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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://ceople-main.onrender.com';

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
        transports: ['polling', 'websocket'], // Try polling first, then upgrade to WebSocket
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
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
        console.error('Backend URL:', BACKEND_URL);
        console.error('Error details:', {
          message: error.message,
          name: error.name
        });
        setState(prev => ({ ...prev, error: `Failed to connect to server: ${error.message}` }));
      });

      socket.on('match-found', (data) => {
        console.log('Match found:', data);
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          isInRoom: true, 
          roomId: data.roomId 
        }));
        
        // Initialize WebRTC for both users
        initializeWebRTC().then(() => {
          // Only the initiator creates the offer
          const isInitiator = data.isInitiator || false;
          console.log('🎯 User role:', isInitiator ? 'Initiator (will create offer)' : 'Responder (will wait for offer)');
          
          if (isInitiator) {
            // Small delay to ensure both users are ready
            setTimeout(() => {
              createOffer();
            }, 1000);
          }
        });
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
      console.log('🚀 Initializing WebRTC...');
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };

      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Get local media stream with mobile-friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user', // Use front camera on mobile
          frameRate: { ideal: 30, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;
      setState(prev => ({ ...prev, localStream: stream }));

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        if (peerConnectionRef.current) {
          console.log('📹 Adding track to peer connection:', track.kind);
          peerConnectionRef.current.addTrack(track, stream);
        }
      });

      // Handle incoming streams
      peerConnectionRef.current.ontrack = (event) => {
        console.log('✅ Received remote stream:', event.streams[0]);
        console.log('📹 Remote stream tracks:', event.streams[0].getTracks().map(t => t.kind));
        setState(prev => ({ ...prev, remoteStream: event.streams[0] }));
      };

      // Handle connection state changes
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('🔗 WebRTC connection state:', peerConnectionRef.current?.connectionState);
        if (peerConnectionRef.current?.connectionState === 'connected') {
          console.log('✅ WebRTC connection established!');
        } else if (peerConnectionRef.current?.connectionState === 'failed') {
          console.error('❌ WebRTC connection failed');
          setState(prev => ({ ...prev, error: 'WebRTC connection failed. Please try again.' }));
        }
      };

      // Handle ICE connection state changes
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', peerConnectionRef.current?.iceConnectionState);
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log('🧊 Sending ICE candidate');
          socketRef.current.emit('webrtc-signal', {
            roomId: state.roomId,
            signal: { type: 'ice-candidate', candidate: event.candidate },
            targetUserId: null
          });
        }
      };

      console.log('✅ WebRTC initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing WebRTC:', error);
      
      // Provide specific error messages for mobile
      let errorMessage = 'Failed to access camera/microphone';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera/microphone permission denied. Please allow access in your browser settings.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please check your device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera/microphone not supported in this browser.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera/microphone is already in use by another application.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [state.roomId]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) {
      console.error('❌ No peer connection available for offer');
      return;
    }

    try {
      console.log('📤 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (socketRef.current) {
        console.log('📤 Sending offer');
        socketRef.current.emit('webrtc-signal', {
          roomId: state.roomId,
          signal: { type: 'offer', sdp: offer },
          targetUserId: null
        });
      }
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  }, [state.roomId]);

  // Handle WebRTC signaling
  const handleWebRTCSignal = useCallback(async (data: any) => {
    try {
      const { signal } = data;
      console.log('📡 Received WebRTC signal:', signal.type);

      if (!peerConnectionRef.current) {
        console.log('⚠️ No peer connection available for signal');
        return;
      }

      if (signal.type === 'offer') {
        console.log('📥 Setting remote description (offer)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        console.log('📤 Creating answer');
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        if (socketRef.current) {
          console.log('📤 Sending answer');
          socketRef.current.emit('webrtc-signal', {
            roomId: state.roomId,
            signal: { type: 'answer', sdp: answer },
            targetUserId: null
          });
        }
      } else if (signal.type === 'answer') {
        console.log('📥 Setting remote description (answer)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate') {
        console.log('🧊 Adding ICE candidate');
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error('❌ Error handling WebRTC signal:', error);
      setState(prev => ({ ...prev, error: `WebRTC signal error: ${error.message}` }));
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
        // Check if screen sharing is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing is not supported in this browser');
        }

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
            await sender.replaceTrack(videoTrack);
            console.log('Screen sharing started successfully');
          }
        }

        setState(prev => ({ ...prev, isScreenSharing: true, error: null }));
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
            await sender.replaceTrack(videoTrack);
            console.log('Screen sharing stopped, camera restored');
          }
        }

        setState(prev => ({ ...prev, isScreenSharing: false, error: null }));
      }
    } catch (error) {
      console.error('Error toggling screen sharing:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to toggle screen sharing';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Screen sharing permission denied. Please allow screen sharing when prompted.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Screen sharing is not supported in this browser.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No screen or window found to share.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setState(prev => ({ ...prev, error: errorMessage }));
      
      // Reset screen sharing state on error
      setState(prev => ({ ...prev, isScreenSharing: false }));
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