import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'user';
type SubscriptionStatus = 'inactive' | 'active' | 'trial';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface Subscription {
  status: string;
  plan: string;
  current_period_end: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  subscription: Subscription | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isSubscribed: boolean;
  isEmailConfirmed: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email')
      .eq('user_id', userId)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleData) {
      setRole(roleData.role as AppRole);
    }

    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .single();

    if (subscriptionData) {
      setSubscription(subscriptionData);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setSubscription(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setSubscription(null);
  };

  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'trial';
  const isEmailConfirmed = !!user?.email_confirmed_at;

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      role, 
      subscription,
      loading, 
      signIn, 
      signUp, 
      signOut, 
      refreshProfile,
      isSubscribed,
      isEmailConfirmed
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
