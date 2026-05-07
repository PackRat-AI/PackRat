'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiLogin,
  apiLogout,
  apiRegister,
  apiResendVerification,
  apiVerifyEmail,
  clearTokens,
  clearUser,
  getAccessToken,
  getRefreshToken,
  getUser,
  setTokens,
  setUser,
  type UserInfo,
} from 'trails-app/lib/auth';

interface AuthState {
  isAuthed: boolean;
  user: UserInfo | null;
  // Pending verification: user registered but hasn't verified email yet
  pendingEmail: string | null;
}

interface AuthActions {
  register(email: string, opts: { password: string; username: string }): Promise<void>;
  verifyEmail(otp: string): Promise<void>;
  resendVerification(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  openAuthGate(): void;
  closeAuthGate(): void;
  authGateOpen: boolean;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

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
    async (email: string, opts: { password: string; username: string }) => {
      await apiRegister({ email, password: opts.password, username: opts.username });
      setState((s) => ({ ...s, pendingEmail: email }));
    },
    [],
  );

  const verifyEmail = useCallback(
    async (otp: string) => {
      if (!state.pendingEmail) throw new Error('No pending email verification');
      const { accessToken, refreshToken, user } = await apiVerifyEmail(state.pendingEmail, otp);
      setTokens(accessToken, refreshToken);
      setUser(user);
      setState({ isAuthed: true, user, pendingEmail: null });
      setAuthGateOpen(false);
    },
    [state.pendingEmail],
  );

  const resendVerification = useCallback(async () => {
    if (!state.pendingEmail) throw new Error('No pending email');
    await apiResendVerification(state.pendingEmail);
  }, [state.pendingEmail]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user } = await apiLogin(email, password);
    setTokens(accessToken, refreshToken);
    setUser(user);
    setState({ isAuthed: true, user, pendingEmail: null });
    setAuthGateOpen(false);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
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
