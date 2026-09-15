import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type Profile, type UserRole, type StudentType } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, department: string, branch?: string, year?: string, section?: string, studentType?: StudentType, societyName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await loadProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
    }
    setProfile(data as Profile | null);
    setLoading(false);
  }

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    let active = true;
    let redirecting = false;

    async function redirectDeletedAccount() {
      if (!active || redirecting) return;
      redirecting = true;
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      setUser(null);
      window.location.replace('/login');
    }

    async function verifyAccountStillExists() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!error && !data) {
        await redirectDeletedAccount();
      }
    }

    const interval = window.setInterval(verifyAccountStillExists, 2000);
    const channel = supabase
      .channel(`profile-deletion-${userId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => { void redirectDeletedAccount(); },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string, role: UserRole, department: string, branch?: string, year?: string, section?: string, studentType?: StudentType, societyName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          department,
          branch,
          year,
          section,
          student_type: studentType,
          society_name: societyName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        return { error: signInError.message };
      }
    }

    return { error: null };
  }

  async function signOut() {
    if (user?.id) {
      await supabase.from('chatbot_history').delete().eq('user_id', user.id);
    }
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
