import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useAuth } from '@/hooks/useAuth';
import { Video, VideoOff, Mic, MicOff, SkipForward, X, Send } from 'lucide-react';

const ChatInterface = () => {
  const { user } = useAuth();
  const {
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
  } = useChatRoom();

  const [messageInput, setMessageInput] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // If not connected to a room, show connection interface
  if (!currentRoom) {
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
            {isConnecting ? (
              <div className="text-center space-y-4">
                <div className="animate-pulse">
                  <div className="h-2 bg-primary/20 rounded-full">
                    <div className="h-2 bg-primary rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isInQueue ? 'Looking for a stranger...' : 'Connecting...'}
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
                >
                  <Video className="mr-2 h-4 w-4" />
                  Start Video Chat
                </Button>
                <Button 
                  onClick={() => joinQueue('text')} 
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Start Text Chat
                </Button>
                <Button 
                  onClick={() => joinQueue('both')} 
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  Start Both
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-2rem)]">
        
        {/* Video Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentRoom.status === 'active' ? 'default' : 'secondary'}>
                {currentRoom.status === 'active' ? 'Connected' : 'Waiting'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={findNext}>
                <SkipForward className="h-4 w-4 mr-1" />
                Next
              </Button>
              <Button variant="destructive" size="sm" onClick={leaveRoom}>
                <X className="h-4 w-4 mr-1" />
                Leave
              </Button>
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[60vh]">
            {/* Local Video */}
            <Card className="relative overflow-hidden">
              <CardContent className="p-0 h-full">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover bg-muted"
                />
                <div className="absolute bottom-4 left-4">
                  <Badge variant="secondary">You</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Remote Video */}
            <Card className="relative overflow-hidden">
              <CardContent className="p-0 h-full">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  className="w-full h-full object-cover bg-muted"
                />
                <div className="absolute bottom-4 left-4">
                  <Badge variant="secondary">Stranger</Badge>
                </div>
                {participants.length < 2 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                    <p className="text-muted-foreground">Waiting for stranger...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Video Controls */}
          <div className="flex justify-center gap-4">
            <Button
              variant={isVideoEnabled ? "default" : "destructive"}
              size="sm"
              onClick={toggleVideo}
            >
              {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
            <Button
              variant={isAudioEnabled ? "default" : "destructive"}
              size="sm"
              onClick={toggleAudio}
            >
              {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Chat</CardTitle>
          </CardHeader>
          <Separator />
          
          {/* Messages */}
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[50vh] p-4">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.user_id === user?.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          message.user_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p>{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <Separator />
          
          {/* Message Input */}
          <CardContent className="p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={!messageInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatInterface;