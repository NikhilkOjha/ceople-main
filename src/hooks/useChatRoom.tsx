import { useState, useEffect, useRef, useCallback } from 'react';
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
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        if (event.candidate && currentRoom && signalingChannelRef.current) {
          signalingChannelRef.current.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: { 
              candidate: event.candidate,
              from: user?.id 
            }
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

  // Setup signaling channel
  const setupSignaling = () => {
    if (!currentRoom || !user) return;

    const channel = supabase.channel(`room_${currentRoom.id}`);
    
    // Handle offers
    channel.on('broadcast', { event: 'offer' }, async (payload) => {
      if (payload.payload.from !== user?.id && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.offer));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { 
              answer,
              from: user?.id 
            }
          });
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      }
    });

    // Handle answers
    channel.on('broadcast', { event: 'answer' }, async (payload) => {
      if (payload.payload.from !== user?.id && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.payload.answer));
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      }
    });

    // Handle ICE candidates
    channel.on('broadcast', { event: 'ice_candidate' }, async (payload) => {
      if (payload.payload.from !== user?.id && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(payload.payload.candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    // Handle user joined
    channel.on('broadcast', { event: 'user_joined' }, async (payload) => {
      if (payload.payload.userId !== user?.id && peerConnectionRef.current) {
        // Create and send offer to the new user
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          
          channel.send({
            type: 'broadcast',
            event: 'offer',
            payload: { 
              offer,
              from: user?.id 
            }
          });
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      }
    });

    channel.subscribe();
    signalingChannelRef.current = channel;
  };

  // Join queue for matching
  const joinQueue = async (chatType: 'video' | 'text' | 'both' = 'both') => {
    if (!user) return;

    setIsConnecting(true);
    setIsInQueue(true);

    try {
      // First, remove any existing queue entry for this user
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', user.id);

      // Add user to queue
      const { error: queueError } = await supabase
        .from('user_queue')
        .insert({
          user_id: user.id,
          chat_type: chatType,
          interests: [] // TODO: Add interest selection
        });

      if (queueError) throw queueError;

      // Try to find an existing waiting room or create a new one
      await findOrCreateRoom(chatType);

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

  // Find existing waiting room or create new one
  const findOrCreateRoom = async (chatType: 'video' | 'text' | 'both' = 'both') => {
    if (!user) return;

    try {
      // Look for waiting rooms
      const { data: waitingRooms } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          chat_participants(*)
        `)
        .eq('status', 'waiting')
        .limit(1);

      let room: ChatRoom;

      if (waitingRooms && waitingRooms.length > 0) {
        // Join existing waiting room
        room = waitingRooms[0] as ChatRoom;
        
        // Add current user as participant
        const { error: participantError } = await supabase
          .from('chat_participants')
          .insert({
            room_id: room.id,
            user_id: user.id
          });

        if (participantError) throw participantError;

        // Update room status to active if we now have 2 participants
        if ((waitingRooms[0] as { chat_participants: unknown[] }).chat_participants.length >= 1) {
          const { error: updateError } = await supabase
            .from('chat_rooms')
            .update({ status: 'active' })
            .eq('id', room.id);

          if (updateError) throw updateError;
        }
      } else {
        // Create new room
        const { data: newRoom, error: roomError } = await supabase
          .from('chat_rooms')
          .insert({ status: 'waiting' })
          .select()
          .single();

        if (roomError) throw roomError;
        room = newRoom as ChatRoom;

        // Add current user as participant
        const { error: participantError } = await supabase
          .from('chat_participants')
          .insert({
            room_id: room.id,
            user_id: user.id
          });

        if (participantError) throw participantError;
      }

      setCurrentRoom(room);
      
      // Remove user from queue
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', user.id);

      setIsInQueue(false);
      setIsConnecting(false);

      // Initialize WebRTC for video chat
      if (chatType === 'video' || chatType === 'both') {
        await initializeWebRTC();
      }

      // Setup signaling
      setupSignaling();

      // Notify other participants
      if (signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'user_joined',
          payload: { userId: user.id }
        });
      }

    } catch (error) {
      console.error('Error finding/creating room:', error);
      toast({
        title: "Room Error",
        description: "Failed to create or join a chat room.",
        variant: "destructive",
      });
    }
  };

  // Send text message
  const sendMessage = async (content: string) => {
    if (!currentRoom || !user || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: currentRoom.id,
          user_id: user.id,
          content: content.trim(),
          message_type: 'text'
        });

      if (error) throw error;
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
      // Remove user from queue if they're in one
      await supabase
        .from('user_queue')
        .delete()
        .eq('user_id', user.id);

      if (currentRoom) {
        // Update participant status
        await supabase
          .from('chat_participants')
          .update({ 
            is_active: false,
            left_at: new Date().toISOString()
          })
          .eq('room_id', currentRoom.id)
          .eq('user_id', user.id);

        // Update room status to ended
        await supabase
          .from('chat_rooms')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString()
          })
          .eq('id', currentRoom.id);
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

      if (signalingChannelRef.current) {
        supabase.removeChannel(signalingChannelRef.current);
        signalingChannelRef.current = null;
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

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!currentRoom) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoom.id)
      .order('created_at', { ascending: true });

    if (data) setMessages(data as Message[]);
  }, [currentRoom]);

  // Load participants
  const loadParticipants = useCallback(async () => {
    if (!currentRoom) return;

    const { data } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('is_active', true);

    if (data) setParticipants(data);
  }, [currentRoom]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentRoom) return;

    // Subscribe to messages
    const messagesSubscription = supabase
      .channel(`messages_${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${currentRoom.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    // Subscribe to participants
    const participantsSubscription = supabase
      .channel(`participants_${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_participants',
          filter: `room_id=eq.${currentRoom.id}`
        },
        (payload) => {
          // Reload participants
          loadParticipants();
        }
      )
      .subscribe();

    // Load initial data
    loadMessages();
    loadParticipants();

    return () => {
      supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(participantsSubscription);
    };
  }, [currentRoom, loadMessages, loadParticipants]);

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