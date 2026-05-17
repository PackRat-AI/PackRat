'use client';

import { fromZod } from '@packrat/guards';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearTokens,
  clearUser,
  getAccessToken,
  getUser,
  setTokens,
  setUser,
  type UserInfo,
  UserInfoSchema,
} from 'trails-app/lib/auth';
import { trailsAuthClient } from 'trails-app/lib/auth-client';

interface AuthState {
  isAuthed: boolean;
  user: UserInfo | null;
  pendingEmail: string | null;
}

interface AuthActions {
  register(email: string, opts: { password: string; firstName?: string }): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  resendVerification(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  openAuthGate(): void;
  closeAuthGate(): void;
  authGateOpen: boolean;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

function parseAuthUser(user: {
  id: string;
  email: string;
  [key: string]: unknown;
}): UserInfo | null {
  return (
    fromZod(UserInfoSchema)({
      id: user.id,
      email: user.email,
      firstName: (user.firstName as string | null | undefined) ?? null,
      lastName: (user.lastName as string | null | undefined) ?? null,
    }) ?? null
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthed: false,
    user: null,
    pendingEmail: null,
  });
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const token = getAccessToken();
    const user = getUser();
    if (token && user) {
      setState({ isAuthed: true, user, pendingEmail: null });
    }
  }, []);

  const register = useCallback(
    async (email: string, opts: { password: string; firstName?: string }) => {
      const name = opts.firstName ?? email;
      const { data, error } = await trailsAuthClient.signUp.email({
        email,
        password: opts.password,
        name,
      });
      if (error) throw new Error(error.message ?? 'Registration failed');
      if (data?.token) {
        // autoSignIn: true succeeded — token is the Bearer session token
        const parsedUser = parseAuthUser(data.user as Parameters<typeof parseAuthUser>[0]);
        if (!parsedUser) throw new Error('Registration failed: unexpected user shape');
        setTokens(data.token, '');
        setUser(parsedUser);
        setState({ isAuthed: true, user: parsedUser, pendingEmail: null });
        setAuthGateOpen(false);
      } else {
        setState((s) => ({ ...s, pendingEmail: email }));
      }
    },
    [],
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      if (!state.pendingEmail) throw new Error('No pending email verification');
      const { error } = await trailsAuthClient.verifyEmail({ query: { token } });
      if (error) throw new Error(error.message ?? 'Verification failed');
      const sessionRes = await trailsAuthClient.getSession();
      if (!sessionRes.data?.session || !sessionRes.data.user) {
        throw new Error('Verification failed: could not get session');
      }
      const parsedUser = parseAuthUser(sessionRes.data.user as Parameters<typeof parseAuthUser>[0]);
      if (!parsedUser) throw new Error('Verification failed: unexpected user shape');
      setTokens(sessionRes.data.session.token, '');
      setUser(parsedUser);
      setState({ isAuthed: true, user: parsedUser, pendingEmail: null });
      setAuthGateOpen(false);
    },
    [state.pendingEmail],
  );

  const resendVerification = useCallback(async () => {
    if (!state.pendingEmail) throw new Error('No pending email');
    const { error } = await trailsAuthClient.sendVerificationEmail({
      email: state.pendingEmail,
      callbackURL: typeof window !== 'undefined' ? window.location.origin : '',
    });
    if (error) throw new Error(error.message ?? 'Resend failed');
  }, [state.pendingEmail]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await trailsAuthClient.signIn.email({ email, password });
    if (error || !data) throw new Error(error?.message ?? 'Login failed');
    const parsedUser = parseAuthUser(data.user as Parameters<typeof parseAuthUser>[0]);
    if (!parsedUser) throw new Error('Login failed: unexpected user shape');
    setTokens(data.token, '');
    setUser(parsedUser);
    setState({ isAuthed: true, user: parsedUser, pendingEmail: null });
    setAuthGateOpen(false);
  }, []);

  const logout = useCallback(async () => {
    await trailsAuthClient.signOut();
    clearTokens();
    clearUser();
    setState({ isAuthed: false, user: null, pendingEmail: null });
  }, []);

  const openAuthGate = useCallback(() => setAuthGateOpen(true), []);
  const closeAuthGate = useCallback(() => setAuthGateOpen(false), []);

  const value = useMemo(
    () => ({
      ...state,
      authGateOpen,
      register,
      verifyEmail,
      resendVerification,
      login,
      logout,
      openAuthGate,
      closeAuthGate,
    }),
    [
      state,
      authGateOpen,
      register,
      verifyEmail,
      resendVerification,
      login,
      logout,
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
