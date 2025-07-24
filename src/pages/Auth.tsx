import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Chrome } from 'lucide-react';

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
      });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password);
    
    if (error) {
      if (error.message.includes('User already registered')) {
        toast({
          title: "Account Exists",
          description: "An account with this email already exists. Please sign in instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link to complete your registration.",
      });
    }
    
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cpath fill='%23667eea' d='M0 0h1920v1080H0z'/%3E%3C/svg%3E"
        >
          <source src="/bg.mp4" type="video/mp4" />
          {/* Fallback gradient background */}
        </video>
        {/* Fallback gradient if video fails */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800" />
      </div>
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50 z-10" />
      
      {/* Content */}
      <div className="relative z-20 w-full max-w-md mx-auto p-6 animate-fade-in">
        {/* Glassmorphism Card */}
        <Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            {/* Logo */}
            <div className="flex justify-center">
              <img
                src="/logo.png"
                alt="Ceople"
                className="h-16 w-auto"
                onError={(e) => {
                  // Fallback to text logo if image fails
                  e.currentTarget.style.display = 'none';
                  const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextSibling) nextSibling.style.display = 'block';
                }}
              />
              <div className="hidden text-4xl font-bold text-white">Ceople</div>
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold text-white mb-2">
                Welcome back to Ceople
              </CardTitle>
              <CardDescription className="text-white/80">
                Connect with strangers around the world
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/10 border-0">
                <TabsTrigger 
                  value="signin" 
                  className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-white text-sm font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-white text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <a href="#" className="text-sm text-white/80 hover:text-white transition-colors">
                      Forgot Password?
                    </a>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 transition-all duration-200 hover:scale-[1.02]" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/20" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-transparent text-white/60">or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all duration-200"
                  >
                    <Chrome className="w-4 h-4 mr-2" />
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-white text-sm font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-white text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Create a password"
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-white text-sm font-medium">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-primary focus:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 transition-all duration-200 hover:scale-[1.02]" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/20" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-transparent text-white/60">or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all duration-200"
                  >
                    <Chrome className="w-4 h-4 mr-2" />
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            {/* Terms & Privacy */}
            <div className="text-center text-xs text-white/60 mt-6">
              By continuing, you agree to our{' '}
              <a href="#" className="text-white/80 hover:text-white underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-white/80 hover:text-white underline">
                Privacy Policy
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;