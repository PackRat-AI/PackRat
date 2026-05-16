'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authClient } from 'trails-app/lib/auth-client';

interface AuthState {
  isAuthed: boolean;
  user: { id: string; email: string; name?: string | null } | null;
}

interface AuthActions {
  register(email: string, opts: { password: string; firstName?: string }): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  openAuthGate(): void;
  closeAuthGate(): void;
  authGateOpen: boolean;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const [authGateOpen, setAuthGateOpen] = useState(false);

  const isAuthed = !!session.data?.user;
  const user = session.data?.user ?? null;

  const register = useCallback(
    async (email: string, { password, firstName }: { password: string; firstName?: string }) => {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: firstName || email,
      });
      if (error) throw new Error(error.message ?? 'Registration failed');
      setAuthGateOpen(false);
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message ?? 'Login failed');
    setAuthGateOpen(false);
  }, []);

  const logout = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : '/reset-password';
    const { error } = await authClient.requestPasswordReset({ email, redirectTo });
    if (error) throw new Error(error.message ?? 'Failed to send reset email');
  }, []);

  const openAuthGate = useCallback(() => setAuthGateOpen(true), []);
  const closeAuthGate = useCallback(() => setAuthGateOpen(false), []);

  const value = useMemo(
    () => ({
      isAuthed,
      user,
      authGateOpen,
      register,
      login,
      logout,
      forgotPassword,
      openAuthGate,
      closeAuthGate,
    }),
    [
      isAuthed,
      user,
      authGateOpen,
      register,
      login,
      logout,
      forgotPassword,
      openAuthGate,
      closeAuthGate,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState & AuthActions {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
