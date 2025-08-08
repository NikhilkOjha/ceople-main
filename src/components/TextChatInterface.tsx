import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useAuth } from '@/hooks/useAuth';
import FeedbackPoll from './FeedbackPoll';

const TextChatInterface = () => {
  const { user, signOut } = useAuth();
  const {
    isConnected,
    isInQueue,
    isInRoom,
    roomId,
    messages,
    sendMessage,
    leaveRoom,
    error,
    joinQueue
  } = useChatRoom();

  const [messageInput, setMessageInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [wasInRoom, setWasInRoom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track when user was in a room to show feedback
  useEffect(() => {
    if (isInRoom) {
      setWasInRoom(true);
    } else if (wasInRoom && !isInQueue) {
      // User just left a room, show feedback after a short delay
      setTimeout(() => {
        setShowFeedback(true);
      }, 500);
    }
  }, [isInRoom, isInQueue, wasInRoom]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  const handleFeedback = async (rating: 'positive' | 'negative') => {
    try {
      // Send feedback to backend
      const response = await fetch(`https://ceople-main.onrender.com/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          userId: user?.id || null,
          roomId: roomId || null,
          chatType: 'text'
        }),
      });

      if (response.ok) {
        console.log('Feedback submitted successfully');
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleFeedbackClose = () => {
    setShowFeedback(false);
    setWasInRoom(false);
  };

  if (!isInRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Ceople Text Chat
            </CardTitle>
            <p className="text-muted-foreground">
              Connect with strangers for text chat
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {isInQueue ? (
              <div className="text-center space-y-4">
                <div className="animate-pulse">
                  <div className="h-2 bg-primary/20 rounded-full">
                    <div className="h-2 bg-primary rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Looking for a stranger...
                </p>
                <Button variant="outline" onClick={leaveRoom}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  onClick={() => joinQueue('text')} 
                  className="w-full"
                  size="lg"
                >
                  Start Text Chat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Feedback Poll */}
        <FeedbackPoll
          isVisible={showFeedback}
          onFeedback={handleFeedback}
          onSkip={handleFeedbackClose}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 border-b bg-white/80" style={{backdropFilter: 'blur(8px)'}}>
        <div className="text-sm font-medium text-gray-700">
          Hello, {user?.user_metadata?.username || (user as any)?.email?.split('@')[0] || 'User'}!
        </div>
        <Button variant="outline" size="sm" onClick={async () => {
          await signOut();
          window.location.href = '/auth';
        }}>
          Log Out
        </Button>
      </div>
      
      {/* Feedback Poll */}
      <FeedbackPoll
        isVisible={showFeedback}
        onFeedback={handleFeedback}
        onSkip={handleFeedbackClose}
      />
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.senderId === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2 p-4 border-t bg-white/80" style={{backdropFilter: 'blur(8px)'}}>
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!messageInput.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
};

export default TextChatInterface;