import { useState, useEffect, useRef } from 'react';
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

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize WebRTC
  const initializeWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
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

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && currentRoom) {
          // Send ICE candidate through Supabase realtime
          supabase.channel(`room_${currentRoom.id}`)
            .send({
              type: 'broadcast',
              event: 'ice_candidate',
              payload: { candidate: event.candidate }
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

  // Join queue for matching
  const joinQueue = async (chatType: 'video' | 'text' | 'both' = 'both') => {
    if (!user) return;

    setIsConnecting(true);
    setIsInQueue(true);

    try {
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
      await findOrCreateRoom();

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
  const findOrCreateRoom = async () => {
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
        if ((waitingRooms[0] as any).chat_participants.length >= 1) {
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
      await initializeWebRTC();

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

  // Leave current room
  const leaveRoom = async () => {
    if (!currentRoom || !user) return;

    try {
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

    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  // Find next stranger
  const findNext = async () => {
    await leaveRoom();
    await joinQueue();
  };

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

    // Subscribe to WebRTC signaling
    const signalingSubscription = supabase
      .channel(`room_${currentRoom.id}`)
      .on('broadcast', { event: 'offer' }, async (payload) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(payload.payload);
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          
          supabase.channel(`room_${currentRoom.id}`)
            .send({
              type: 'broadcast',
              event: 'answer',
              payload: answer
            });
        }
      })
      .on('broadcast', { event: 'answer' }, async (payload) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(payload.payload);
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, async (payload) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(payload.payload.candidate);
        }
      })
      .subscribe();

    // Load initial data
    loadMessages();
    loadParticipants();

    return () => {
      supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(participantsSubscription);
      supabase.removeChannel(signalingSubscription);
    };
  }, [currentRoom]);

  // Load messages
  const loadMessages = async () => {
    if (!currentRoom) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoom.id)
      .order('created_at', { ascending: true });

    if (data) setMessages(data as Message[]);
  };

  // Load participants
  const loadParticipants = async () => {
    if (!currentRoom) return;

    const { data } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('is_active', true);

    if (data) setParticipants(data);
  };

  return {
    currentRoom,
    messages,
    participants,
    isInQueue,
    isConnecting,
    localVideoRef,
    remoteVideoRef,
    joinQueue,
    sendMessage,
    leaveRoom,
    findNext
  };
};