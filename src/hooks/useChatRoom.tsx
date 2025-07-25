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
  const currentRoomIdRef = useRef<string | null>(null);

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
        console.log('🎯 Match found:', data);
        
        // Set the room ID in both state and ref
        currentRoomIdRef.current = data.roomId;
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          isInRoom: true, 
          roomId: data.roomId 
        }));
        
        // Wait for state to update, then initialize WebRTC
        setTimeout(() => {
          initializeWebRTC().then(() => {
            console.log('✅ WebRTC initialized');
            
            // Only the initiator creates an offer
            if (data.isInitiator) {
              console.log('🎯 I am the initiator, creating offer...');
              setTimeout(() => {
                createOfferWithRoomId(data.roomId);
              }, 500);
            } else {
              console.log('🎯 I am the responder, waiting for offer...');
            }
          }).catch(error => {
            console.error('❌ Error initializing WebRTC:', error);
          });
        }, 100);
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

      socket.on('webrtc-pong', (data) => {
        console.log('🏓 WebRTC pong received from user:', data.fromUserId);
      });

      socket.on('user-left', (data) => {
        console.log('User left:', data);
        
        // Clean up WebRTC
        cleanupWebRTC();
        
        // Go back to queue instead of showing error
        setState(prev => ({ 
          ...prev, 
          isInRoom: false, 
          isInQueue: true,
          roomId: null,
          messages: [],
          remoteStream: null,
          error: null // Clear any errors
        }));
        
        // Automatically rejoin queue
        setTimeout(() => {
          if (socketRef.current) {
            console.log('🔄 Auto-rejoining queue after user left');
            socketRef.current.emit('join-queue', { chatType: 'video' });
          }
        }, 1000);
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
    
    // Clear room ID ref
    currentRoomIdRef.current = null;
    
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
          // STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // TURN servers for mobile/NAT traversal
          { 
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: [
              'turn:global.turn.twilio.com:3478?transport=udp',
              'turn:global.turn.twilio.com:3478?transport=tcp',
              'turn:global.turn.twilio.com:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all' as RTCIceTransportPolicy,
        bundlePolicy: 'max-bundle' as RTCBundlePolicy,
        rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
      };

      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Get local media stream with mobile-friendly constraints
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isMobile ? {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user', // Use front camera on mobile
          frameRate: { ideal: 24, min: 15 }
        } : {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 }
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
          // Don't show error if we're already leaving the room
          if (state.isInRoom) {
            setState(prev => ({ ...prev, error: 'Connection lost. Looking for new stranger...' }));
          }
        }
      };

      // Handle ICE connection state changes
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        const iceState = peerConnectionRef.current?.iceConnectionState;
        console.log('🧊 ICE connection state:', iceState);
        
        if (iceState === 'failed') {
          console.error('❌ ICE connection failed - this often happens on mobile networks');
          console.log('📱 Mobile detection:', isMobile);
          console.log('🌐 Network info:', (navigator as any).connection || 'Not available');
        } else if (iceState === 'connected') {
          console.log('✅ ICE connection established successfully');
        }
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          // Use the roomId from ref (immediately available)
          const currentRoomId = currentRoomIdRef.current;
          if (currentRoomId) {
            console.log('🧊 Sending ICE candidate to room:', currentRoomId);
            socketRef.current.emit('webrtc-signal', {
              roomId: currentRoomId,
              signal: { type: 'ice-candidate', candidate: event.candidate },
              targetUserId: null
            });
          } else {
            console.log('⚠️ Cannot send ICE candidate - roomId not set yet');
          }
        } else {
          console.log('⚠️ Cannot send ICE candidate - missing candidate or socket');
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

  // Create and send offer with explicit room ID
  const createOfferWithRoomId = useCallback(async (roomId: string) => {
    if (!peerConnectionRef.current) {
      console.error('❌ No peer connection available for offer');
      return;
    }

    if (!socketRef.current) {
      console.error('❌ No socket connection available for offer');
      return;
    }

    if (!roomId) {
      console.error('❌ No room ID provided for offer');
      return;
    }

    try {
      console.log('📤 Creating offer for room:', roomId);
      const offer = await peerConnectionRef.current.createOffer();
      console.log('📤 Offer created, setting local description...');
      await peerConnectionRef.current.setLocalDescription(offer);

      console.log('📤 Sending offer via socket to room:', roomId);
      socketRef.current.emit('webrtc-signal', {
        roomId: roomId,
        signal: { type: 'offer', sdp: offer },
        targetUserId: null
      });
      console.log('✅ Offer sent successfully');
      
      // Test: Log the offer SDP to see if it's valid
      console.log('📋 Offer SDP preview:', offer.sdp.substring(0, 200) + '...');
      
      // Test: Send a ping to verify signaling is working
      setTimeout(() => {
        if (socketRef.current && roomId) {
          console.log('🏓 Sending WebRTC ping test to room:', roomId);
          socketRef.current.emit('webrtc-ping', { roomId: roomId });
        }
      }, 1000);
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  }, []);

  // Create and send offer (legacy function)
  const createOffer = useCallback(async () => {
    if (!state.roomId) {
      console.error('❌ No room ID available for offer');
      return;
    }
    return createOfferWithRoomId(state.roomId);
  }, [state.roomId, createOfferWithRoomId]);

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
        // Check if we already have a remote description
        if (peerConnectionRef.current.remoteDescription) {
          console.log('⚠️ Already have remote description, ignoring duplicate offer');
          return;
        }
        
        console.log('📥 Setting remote description (offer)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        console.log('📤 Creating answer');
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        if (socketRef.current) {
          console.log('📤 Sending answer');
          const currentRoomId = currentRoomIdRef.current;
          if (currentRoomId) {
            socketRef.current.emit('webrtc-signal', {
              roomId: currentRoomId,
              signal: { type: 'answer', sdp: answer },
              targetUserId: null
            });
            console.log('✅ Answer sent to room:', currentRoomId);
          } else {
            console.error('❌ Cannot send answer - no room ID available');
          }
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
    toggleScreenSharing,
    createOffer
  };
};