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
  const { user, signOut } = useAuth();
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
    toggleScreenSharing,
    createOffer
  } = useChatRoom();

  const [messageInput, setMessageInput] = useState('');
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      setPermissionRequested(true);
      setCameraError(null);
      console.log('📱 Requesting camera permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Camera permission granted');
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
      // Reset permission state
      setPermissionRequested(false);
      
      // Now join the queue
      joinQueue('video');
    } catch (error: any) {
      console.error('❌ Camera permission denied:', error);
      setPermissionRequested(false);
      setCameraError('Camera permission is required for video chat. Please allow camera access in your browser settings and try again.');
    }
  };

  // Reset permission state when leaving room
  useEffect(() => {
    if (!isInRoom && !isInQueue) {
      setPermissionRequested(false);
    }
  }, [isInRoom, isInQueue]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set video streams with mobile-specific handling
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('📹 Setting local video stream');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.onloadedmetadata = () => {
        console.log('✅ Local video metadata loaded');
        localVideoRef.current?.play().catch(e => {
          console.error('Local video play error:', e);
          // On mobile, sometimes we need to handle autoplay restrictions
          if (e.name === 'NotAllowedError') {
            console.log('📱 Mobile autoplay blocked, user needs to interact first');
          }
        });
      };
      // Force play on mobile after a short delay
      setTimeout(() => {
        if (localVideoRef.current && localStream) {
          localVideoRef.current.play().catch(e => console.error('Delayed play error:', e));
        }
      }, 1000);
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('📹 Setting remote video stream');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.onloadedmetadata = () => {
        console.log('✅ Remote video metadata loaded');
        remoteVideoRef.current?.play().catch(e => {
          console.error('Remote video play error:', e);
          // On mobile, sometimes we need to handle autoplay restrictions
          if (e.name === 'NotAllowedError') {
            console.log('📱 Mobile autoplay blocked, user needs to interact first');
          }
        });
      };
      // Force play on mobile after a short delay
      setTimeout(() => {
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.play().catch(e => console.error('Delayed play error:', e));
        }
      }, 1000);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4 relative">
        {/* Fixed Header with Logout Button */}
        <div className="fixed top-0 right-0 left-0 z-50 flex justify-end items-center bg-white/80 border-b border-gray-200 px-4 py-2" style={{backdropFilter: 'blur(8px)'}}>
          <Button variant="outline" size="sm" onClick={async () => {
            await signOut();
            window.location.href = '/auth';
          }}>
            Log Out
          </Button>
        </div>
        <div className="pt-14"> {/* Add padding to avoid header overlap */}
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
              {cameraError && (
                <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800">
                  <p className="text-sm">{cameraError}</p>
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
                    onClick={requestCameraPermission}
                    disabled={permissionRequested}
                    className="w-full"
                    size="lg"
                  >
                    <Video className="mr-2 h-4 w-4" />
                    {permissionRequested ? 'Requesting Permission...' : 'Start Video Chat'}
                  </Button>
                  <Button 
                    onClick={() => joinQueue('text')} 
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Start Text Chat
                  </Button>
                  <Button 
                    onClick={() => joinQueue('video')} 
                    variant="secondary"
                    className="w-full"
                    size="lg"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Start Both
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Video chat interface
  return (
    <div className="min-h-screen bg-background p-4 relative">
      {/* Fixed Header with Username and Logout Button */}
      <div className="fixed top-0 right-0 left-0 z-50 flex justify-between items-center bg-white/80 border-b border-gray-200 px-4 py-2" style={{backdropFilter: 'blur(8px)'}}>
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
      <div className="pt-14"> {/* Add padding to avoid header overlap */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-2rem)]">
          
          {/* Video Area */}
          <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isInRoom ? 'default' : 'secondary'}>
                {isInRoom ? 'Connected' : 'Waiting'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Room: {roomId?.slice(0, 8)}...
              </span>
              <span className="text-sm text-muted-foreground">
                • {user?.user_metadata?.username || (user as any)?.email?.split('@')[0] || 'User'}
              </span>
            </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  leaveRoom();
                  setTimeout(() => joinQueue('video'), 100);
                }}>
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
                     playsInline
                     controls={false}
                     className="w-full h-full object-cover bg-muted"
                     style={{ transform: 'scaleX(-1)' }} // Mirror local video
                     onError={(e) => console.error('Local video error:', e)}
                     onLoadStart={() => console.log('📹 Local video loading started')}
                     onCanPlay={() => console.log('📹 Local video can play')}
                   />
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary">You</Badge>
                  </div>
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <VideoOff className="h-12 w-12 text-white" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Remote Video */}
              <Card className="relative overflow-hidden">
                <CardContent className="p-0 h-full">
                                   <video
                   ref={remoteVideoRef}
                   autoPlay
                   playsInline
                   controls={false}
                   className="w-full h-full object-cover bg-muted"
                   onError={(e) => console.error('Remote video error:', e)}
                   onLoadStart={() => console.log('📹 Remote video loading started')}
                   onCanPlay={() => console.log('📹 Remote video can play')}
                 />
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary">Stranger</Badge>
                  </div>
                  {!remoteStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-muted-foreground">Waiting for stranger...</p>
                        <p className="text-xs text-muted-foreground mt-1">Connecting...</p>
                      </div>
                    </div>
                  )}
                  {remoteStream && remoteStream.getVideoTracks().length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center">
                        <VideoOff className="h-12 w-12 text-white mx-auto mb-2" />
                        <p className="text-white">Stranger's camera is off</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Video Controls */}
            <div className="flex justify-center gap-4">
              <Button
                variant={isVideoEnabled ? "default" : "destructive"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12 p-0"
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
              <Button
                variant={isAudioEnabled ? "default" : "destructive"}
                size="lg"
                onClick={toggleAudio}
                className="rounded-full w-12 h-12 p-0"
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button
                variant={isScreenSharing ? "default" : "outline"}
                size="lg"
                onClick={toggleScreenSharing}
                className="rounded-full w-12 h-12 p-0"
              >
                <Monitor className="h-5 w-5" />
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-12 h-12 p-0"
              >
                <PhoneOff className="h-5 w-5" />
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
                    messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.senderId === user?.id ? 'justify-end' : 'justify-start'
                        }`}
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
    </div>
  );
};

export default ChatInterface;