import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const MobileDebug = () => {
  const { user, session, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const gatherDebugInfo = async () => {
      const info = {
        userAgent: navigator.userAgent,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        localStorage: (() => {
          try {
            return {
              available: true,
              test: localStorage.setItem('test', 'test'),
              clear: localStorage.removeItem('test')
            };
          } catch (error) {
            return { available: false, error: error.message };
          }
        })(),
        sessionStorage: (() => {
          try {
            return {
              available: true,
              test: sessionStorage.setItem('test', 'test'),
              clear: sessionStorage.removeItem('test')
            };
          } catch (error) {
            return { available: false, error: error.message };
          }
        })(),
        user: user ? { id: user.id, email: user.email } : null,
        session: session ? { access_token: !!session.access_token } : null,
        loading,
        timestamp: new Date().toISOString()
      };

      setDebugInfo(info);
      console.log('🔍 Mobile Debug Info:', info);
    };

    gatherDebugInfo();
  }, [user, session, loading]);

  // Only show on mobile devices
  if (!debugInfo.isMobile) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-xs z-50">
      <h3 className="font-bold mb-2">Mobile Debug</h3>
      <div className="space-y-1">
        <div>User: {user ? '✅' : '❌'}</div>
        <div>Session: {session ? '✅' : '❌'}</div>
        <div>Loading: {loading ? '⏳' : '✅'}</div>
        <div>localStorage: {debugInfo.localStorage?.available ? '✅' : '❌'}</div>
        <div>sessionStorage: {debugInfo.sessionStorage?.available ? '✅' : '❌'}</div>
      </div>
    </div>
  );
}; 