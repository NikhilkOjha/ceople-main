import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type GuestUser = {
  id: string;
  user_metadata: { username: string };
  isGuest: true;
};

interface AuthContextType {
  user: User | GuestUser | null;
  session: Session | null;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  setGuest: (username: string) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | GuestUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for guest user in localStorage
    const guest = localStorage.getItem('guestUser');
    if (guest) {
      setUser(JSON.parse(guest));
      setLoading(false);
      return;
    }
    console.log('🔐 AuthProvider: Initializing authentication...');
    
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('📱 Mobile device detected:', isMobile);
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setGuest = (username: string) => {
    const guestUser: GuestUser = {
      id: 'guest-' + Math.random().toString(36).slice(2),
      user_metadata: { username },
      isGuest: true,
    };
    setUser(guestUser);
    localStorage.setItem('guestUser', JSON.stringify(guestUser));
  };

  const signUp = async (email: string, password: string, username?: string) => {
    console.log('🔐 Signing up user:', email, username);
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username }
      }
    });
    
    if (error) {
      console.error('❌ Sign up error:', error);
    } else {
      console.log('✅ Sign up successful');
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Signing in user:', email);
    
    try {
      // Clear any existing session first (mobile fix)
      await supabase.auth.signOut();
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ Sign in error:', error);
      } else {
        console.log('✅ Sign in successful');
        
        // Force session refresh on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          console.log('📱 Mobile device detected, refreshing session...');
          setTimeout(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('📱 Session refresh result:', session?.user?.id ? 'Success' : 'Failed');
          }, 1000);
        }
      }
      
      return { error };
    } catch (error) {
      console.error('❌ Sign in exception:', error);
      return { error };
    }
  };

  const signOut = async () => {
    console.log('🔐 Signing out user');
    
    try {
      // Remove guest user if present
      localStorage.removeItem('guestUser');
      if (user && (user as GuestUser).isGuest) {
        setUser(null);
        setSession(null);
        return { error: null };
      }
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      return { error };
    } catch (error) {
      console.error('❌ Sign out exception:', error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      signUp,
      signIn,
      signOut,
      setGuest,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};