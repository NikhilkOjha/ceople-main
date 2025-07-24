import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useAuth } from '@/hooks/useAuth';
import { Video, VideoOff, Mic, MicOff, SkipForward, X, Send, Phone, PhoneOff, Monitor } from 'lucide-react';

const ChatInterface = () => {
  const { user } = useAuth();
  const {
    isConnected,
    isInQueue,
    isInRoom,
    roomId,
    messages,
    remoteStream,
    localStream,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    error,
    joinQueue,
    sendMessage,
    leaveRoom,
    toggleVideo,
    toggleAudio,
    toggleScreenSharing
  } = useChatRoom();

  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  // If not connected to a room, show connection interface
  if (!isInRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Ceople Chat
            </CardTitle>
            <p className="text-muted-foreground">
              Connect with strangers around the world
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
                  onClick={() => joinQueue('video')} 
                  className="w-full"
                  size="lg"
                  disabled={!isConnected}
                >
                  <Video className="mr-2 h-4 w-4" />
                  Start Video Chat
                </Button>
                <Button 
                  onClick={() => joinQueue('text')} 
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={!isConnected}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Start Text Chat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Video chat interface
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">Room: {roomId?.slice(0, 8)}...</Badge>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleVideo}
              className={!isVideoEnabled ? "bg-destructive/10 text-destructive" : ""}
            >
              {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAudio}
              className={!isAudioEnabled ? "bg-destructive/10 text-destructive" : ""}
            >
              {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleScreenSharing}
              className={isScreenSharing ? "bg-primary/10 text-primary" : ""}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={leaveRoom}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Video area */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Remote video */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-white">
                    <VideoOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Waiting for stranger...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Local video */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-white">
                    <VideoOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera not available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="w-80 border-l bg-card">
          <div className="flex flex-col h-full">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.senderId === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;