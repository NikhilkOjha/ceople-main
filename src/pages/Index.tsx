import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, MessageCircle, Users, Shield } from 'lucide-react';

const Index = () => {
  const { user, signOut, loading } = useAuth();

  // Redirect to auth if not authenticated
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Ceople
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome back!
            </span>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-4xl font-bold">Connect with Strangers Worldwide</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the next generation of random video and text chat. Safe, smart, and seamless connections with people around the globe.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Video className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Video Chat</CardTitle>
              <CardDescription>
                Face-to-face conversations with strangers using WebRTC technology
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/chat">
                <Button className="w-full">Start Video Chat</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <MessageCircle className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Text Chat</CardTitle>
              <CardDescription>
                Quick and easy text conversations with real-time messaging
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/text-chat">
                <Button variant="outline" className="w-full">Start Text Chat</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Group Rooms</CardTitle>
              <CardDescription>
                Join public chat rooms on trending topics (Coming Soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Why Choose Ceople?</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">AI-Powered Safety</h4>
                  <p className="text-sm text-muted-foreground">
                    Advanced moderation and content filtering for a safer experience
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Video className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">HD Video Quality</h4>
                  <p className="text-sm text-muted-foreground">
                    Crystal clear video calls using modern WebRTC technology
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Real-time Translation</h4>
                  <p className="text-sm text-muted-foreground">
                    Break language barriers with AI-powered translation (Coming Soon)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Getting Started</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Choose Your Chat Type</h4>
                  <p className="text-sm text-muted-foreground">
                    Select video, text, or both for your chat experience
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Get Matched</h4>
                  <p className="text-sm text-muted-foreground">
                    Our smart matching system connects you with compatible strangers
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Start Chatting</h4>
                  <p className="text-sm text-muted-foreground">
                    Enjoy your conversation and use "Next" to meet someone new
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
