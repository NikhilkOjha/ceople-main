import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { 
  Phone, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MessageSquare, 
  Share, 
  RotateCcw, 
  MoreVertical, 
  ChevronDown, 
  Plus, 
  User,
  Send,
  ArrowLeft
} from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
  isVideoOn: boolean;
  isAudioOn: boolean;
}

const VideoConference: React.FC = () => {
  const [isRecording, setIsRecording] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingUser, setCurrentTypingUser] = useState('');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Ryan Gosling',
      content: 'Thanks for sharing',
      timestamp: new Date(Date.now() - 300000)
    },
    {
      id: '2',
      sender: 'Clint Eastwood',
      content: 'Great tips! Thanks 🏆',
      timestamp: new Date(Date.now() - 180000)
    },
    {
      id: '3',
      sender: 'Robert Downey',
      content: 'Love this conversation 😊',
      timestamp: new Date(Date.now() - 60000)
    }
  ]);

  const [participants] = useState<Participant[]>([
    { id: '1', name: 'Jennifer Aniston', avatar: '/api/placeholder/40/40', isVideoOn: true, isAudioOn: true },
    { id: '2', name: 'Ryan Gosling', avatar: '/api/placeholder/40/40', isVideoOn: false, isAudioOn: true },
    { id: '3', name: 'Clint Eastwood', avatar: '/api/placeholder/40/40', isVideoOn: false, isAudioOn: true },
    { id: '4', name: 'Robert Downey', avatar: '/api/placeholder/40/40', isVideoOn: false, isAudioOn: true },
  ]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Typing effect
  useEffect(() => {
    const typingUsers = ['Robert', 'Ryan', 'Clint'];
    const interval = setInterval(() => {
      const randomUser = typingUsers[Math.floor(Math.random() * typingUsers.length)];
      setCurrentTypingUser(randomUser);
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        setCurrentTypingUser('');
      }, 3000);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'You',
        content: message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <Button variant="ghost" size="sm" className="p-2 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">Frederick Douglass Meeting Room</h1>
          <p className="text-sm text-gray-500">15 Participants Online</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Video Section */}
        <div className="flex-1 relative bg-black">
          {/* Main Video */}
          <div className="relative w-full h-full">
            {/* Main video placeholder */}
            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <User className="w-16 h-16" />
                </div>
                <p className="text-lg font-medium">Jennifer Aniston</p>
                <p className="text-sm opacity-80">Publisher</p>
              </div>
            </div>

            {/* Recording indicator */}
            <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/50 text-white px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">{formatDuration(callDuration)}</span>
            </div>

            {/* Inset Video */}
            <div className="absolute top-4 right-4 w-32 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
              <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-2">
                    <User className="w-6 h-6" />
                  </div>
                  <p className="text-xs">Ryan Gosling</p>
                </div>
              </div>
            </div>

            {/* Participant Avatars */}
            <div className="absolute top-4 right-48 flex flex-col space-y-2">
              {participants.slice(1, 3).map((participant) => (
                <div key={participant.id} className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              ))}
            </div>

            {/* Floating Action Buttons */}
            <div className="absolute right-4 top-48 flex flex-col space-y-3">
              <Button size="sm" className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600">
                <Plus className="w-4 h-4" />
              </Button>
              <Button size="sm" className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600">
                <User className="w-4 h-4" />
              </Button>
              <Button size="sm" className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600">
                <Phone className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                  <Share className="w-5 h-5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center space-x-3">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white hover:bg-white/20"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="w-5 h-5" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsAudioOn(!isAudioOn)}
                >
                  {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white hover:bg-white/20"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center space-x-3">
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                  <ChevronDown className="w-5 h-5" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsAudioOn(!isAudioOn)}
                >
                  {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* End Call Button */}
            <div className="flex justify-center mt-3">
              <Button 
                size="lg" 
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600"
              >
                <Phone className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Section */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{msg.sender}</span>
                        <span className="text-xs text-gray-500">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                        {msg.content}
                      </p>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500 italic">
                      <span>{currentTypingUser} is typing...</span>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="ghost" className="p-2">
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Input
                    placeholder="Type your message here"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    className="bg-red-500 hover:bg-red-600 p-2"
                    onClick={handleSendMessage}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConference; 