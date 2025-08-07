import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailSignupFormProps {
  title?: string;
  description?: string;
  placeholder?: string;
  buttonText?: string;
  source?: string;
  className?: string;
}

const EmailSignupForm: React.FC<EmailSignupFormProps> = ({
  title = "Stay Updated",
  description = "Get notified about new features and updates",
  placeholder = "Enter your email address",
  buttonText = "Subscribe",
  source = "website",
  className = ""
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setStatus('idle');

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/email-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          source
        }),
      });

      if (response.ok) {
        setStatus('success');
        setEmail('');
        toast({
          title: "Success!",
          description: "You've been subscribed to our newsletter",
        });
      } else {
        const data = await response.json();
        if (response.status === 409) {
          setStatus('error');
          toast({
            title: "Already Subscribed",
            description: "This email is already subscribed to our newsletter",
            variant: "destructive"
          });
        } else {
          setStatus('error');
          toast({
            title: "Error",
            description: data.error || "Failed to subscribe. Please try again.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      setStatus('error');
      toast({
        title: "Error",
        description: "Failed to subscribe. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder={placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={`${
                status === 'success' ? 'border-green-500' : 
                status === 'error' ? 'border-red-500' : ''
              }`}
            />
            {status === 'success' && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Successfully subscribed!</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center space-x-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>Failed to subscribe. Please try again.</span>
              </div>
            )}
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                <span>Subscribing...</span>
              </div>
            ) : (
              buttonText
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default EmailSignupForm;
