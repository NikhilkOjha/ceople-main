import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FeedbackDashboard from '@/components/FeedbackDashboard';
import EmailSignupsDashboard from '@/components/EmailSignupsDashboard';
import ChatSessionsDashboard from '@/components/ChatSessionsDashboard';
import UserLocationsDashboard from '@/components/UserLocationsDashboard';
import { ArrowLeft, Shield, BarChart3, Mail, MessageCircle, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

const Admin = () => {
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

  // Simple admin check - you might want to implement proper role-based access
  const isAdmin = (user && 'email' in user && user.email === 'admin@ceople.com') || 
                  (user && 'user_metadata' in user && 'role' in user.user_metadata && user.user_metadata.role === 'admin');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/">
              <Button className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back Home
              </Button>
            </Link>
          </CardContent>
        </Card>
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
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Admin: {user && 'user_metadata' in user ? user.user_metadata.username : 
                      user && 'email' in user ? user.email : 'Unknown'}
            </span>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="feedback" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="feedback" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Feedback</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span>Email Signups</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Chat Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>User Locations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="space-y-6">
            <FeedbackDashboard />
          </TabsContent>

          <TabsContent value="emails" className="space-y-6">
            <EmailSignupsDashboard />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <ChatSessionsDashboard />
          </TabsContent>

          <TabsContent value="locations" className="space-y-6">
            <UserLocationsDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
