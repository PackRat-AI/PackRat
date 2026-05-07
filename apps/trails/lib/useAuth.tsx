'use client';

import { asStringRecord, fromZod } from '@packrat/guards';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from 'trails-app/lib/apiClient';
import {
  clearTokens,
  clearUser,
  getAccessToken,
  getRefreshToken,
  getUser,
  setTokens,
  setUser,
  type UserInfo,
  UserInfoSchema,
} from 'trails-app/lib/auth';

interface AuthState {
  isAuthed: boolean;
  user: UserInfo | null;
  // Pending verification: user registered but hasn't verified email yet
  pendingEmail: string | null;
}

interface AuthActions {
  register(email: string, opts: { password: string; firstName?: string }): Promise<void>;
  verifyEmail(otp: string): Promise<void>;
  resendVerification(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  openAuthGate(): void;
  closeAuthGate(): void;
  authGateOpen: boolean;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

function apiError(error: unknown, fallback: string): Error {
  const msg = asStringRecord(error).message;
  return new Error(msg ?? fallback);
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
      const { error, status } = await apiClient.auth.register.post({
        email,
        password: opts.password,
        firstName: opts.firstName,
      });
      if (error) throw apiError(error.value, `Registration failed: ${status}`);
      setState((s) => ({ ...s, pendingEmail: email }));
    },
    [],
  );

  const verifyEmail = useCallback(
    async (otp: string) => {
      if (!state.pendingEmail) throw new Error('No pending email verification');
      const { data, error, status } = await apiClient.auth['verify-email'].post({
        email: state.pendingEmail,
        code: otp,
      });
      if (error || !data) throw apiError(error?.value, `Verification failed: ${status}`);
      const { accessToken, refreshToken, user } = data;
      if (!accessToken || !refreshToken || !user) {
        throw new Error('Verification failed: missing token data');
      }
      const parsedUser = fromZod(UserInfoSchema)(user);
      if (!parsedUser) throw new Error('Verification failed: unexpected user shape');
      setTokens(accessToken, refreshToken);
      setUser(parsedUser);
      setState({ isAuthed: true, user: parsedUser, pendingEmail: null });
      setAuthGateOpen(false);
    },
    [state.pendingEmail],
  );

  const resendVerification = useCallback(async () => {
    if (!state.pendingEmail) throw new Error('No pending email');
    const { error, status } = await apiClient.auth['resend-verification'].post({
      email: state.pendingEmail,
    });
    if (error) throw apiError(error.value, `Resend failed: ${status}`);
  }, [state.pendingEmail]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error, status } = await apiClient.auth.login.post({ email, password });
    if (error || !data) throw apiError(error?.value, `Login failed: ${status}`);
    const { accessToken, refreshToken, user } = data;
    if (!accessToken || !refreshToken || !user) {
      throw new Error('Login failed: missing token data');
    }
    const parsedUser = fromZod(UserInfoSchema)(user);
    if (!parsedUser) throw new Error('Login failed: unexpected user shape');
    setTokens(accessToken, refreshToken);
    setUser(parsedUser);
    setState({ isAuthed: true, user: parsedUser, pendingEmail: null });
    setAuthGateOpen(false);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiClient.auth.logout.post({ refreshToken });
      } catch {
        // ignore — clear tokens regardless
      }
    }
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
