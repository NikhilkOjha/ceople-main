import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Welcome to Ceople
        </h1>
        <p className="text-xl text-muted-foreground">
          Ready to connect with strangers around the world?
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg">Start Video Chat</Button>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
