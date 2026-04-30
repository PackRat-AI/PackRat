import type { AxiosError } from 'axios';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { userStore } from 'expo-app/features/auth/store';
import axiosInstance from 'expo-app/lib/api/client';
import { t } from 'expo-app/lib/i18n';
import { type Href, router } from 'expo-router';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  isLoadingAtom,
  needsReauthAtom,
  redirectToAtom,
  refreshTokenAtom,
  tokenAtom,
} from '../atoms/authAtoms';

/**
 * Web version of useAuthActions.
 * Removes native-only auth flows:
 *   - signInWithGoogle (uses @react-native-google-signin/google-signin — native only)
 *   - signInWithApple (uses expo-apple-authentication — iOS only)
 * Replaces expo-sqlite/kv-store and expo-updates with localStorage / window.location.
 * Metro automatically picks this file over useAuthActions.ts for web builds.
 */

function redirect(route: string) {
  try {
    const parsedRoute: Href = JSON.parse(route);
    return router.dismissTo(parsedRoute);
  } catch {
    router.dismissTo(route as Href);
  }
}

export function useAuthActions() {
  const setToken = useSetAtom(tokenAtom);
  const setRefreshToken = useSetAtom(refreshTokenAtom);
  const refreshToken = useAtomValue(refreshTokenAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const redirectTo = useAtomValue(redirectToAtom);
  const setNeedsReauth = useSetAtom(needsReauthAtom);

  const clearLocalData = async () => {
    localStorage.clear();
    sessionStorage.clear();
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToSignIn'));
      }

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user);
      setNeedsReauth(false);
      redirect(redirectTo);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /** Google OAuth on web uses a redirect flow — not yet implemented. */
  const signInWithGoogle = async () => {
    throw new Error('Google Sign-In is not yet supported on web. Please use email/password.');
  };

  /** Apple Sign-In is iOS-only. */
  const signInWithApple = async () => {
    throw new Error('Apple Sign-In is not supported on web. Please use email/password.');
  };

  const signUp = async ({
    email,
    password,
    firstName,
    lastName,
  }: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || t('auth.registrationFailed'));
      }
    } catch (error) {
      console.error('Registration error:', (error as AxiosError).message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (refreshToken) {
        await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setToken(null);
      setRefreshToken(null);
      await clearLocalData();
      setNeedsReauth(false);
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToProcessRequest'));
      }

      return data;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string, opts: { code: string; newPassword: string }) => {
    const { code, newPassword } = opts;
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.resetPasswordFailed'));
      }

      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToVerifyEmail'));
      }

      if (data.accessToken && data.refreshToken && data.user) {
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        await setToken(data.accessToken);
        await setRefreshToken(data.refreshToken);
        userStore.set(data.user);
        redirect(redirectTo);
      }

      return data;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const response = await fetch(
        `${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/resend-verification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToResendVerificationEmail'));
      }

      return data;
    } catch (error) {
      console.error('Resend verification email error:', error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.delete('/api/auth');

      if (response.status !== 200) {
        throw new Error(response.data?.error || t('auth.failedToDeleteAccount'));
      }

      setToken(null);
      setRefreshToken(null);
      await clearLocalData();
      window.location.reload();
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    signInWithGoogle,
    signInWithApple,
    signUp,
    signOut,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    deleteAccount,
  };
}
