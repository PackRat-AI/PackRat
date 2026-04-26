import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { userStore } from 'expo-app/features/auth/store';
import type { User } from 'expo-app/features/profile/types';
import { apiClient } from 'expo-app/lib/api/packrat';
import { t } from 'expo-app/lib/i18n';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import * as AppleAuthentication from 'expo-apple-authentication';
import { type Href, router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  isLoadingAtom,
  needsReauthAtom,
  redirectToAtom,
  refreshTokenAtom,
  tokenAtom,
} from '../atoms/authAtoms';

function redirect(route: string) {
  try {
    const parsedRoute: Href = JSON.parse(route);
    return router.dismissTo(parsedRoute);
  } catch {
    router.dismissTo(route as Href);
  }
}

function extractAuthError(value: unknown, fallback: string): string {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    return String((value as Record<string, unknown>).error) || fallback;
  }
  return fallback;
}

export function useAuthActions() {
  const setToken = useSetAtom(tokenAtom);
  const setRefreshToken = useSetAtom(refreshTokenAtom);
  const refreshToken = useAtomValue(refreshTokenAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const redirectTo = useAtomValue(redirectToAtom);
  const setNeedsReauth = useSetAtom(needsReauthAtom);

  const clearLocalData = async () => {
    const allKeys = await Storage.getAllKeys();
    await Promise.all(allKeys.map((key) => Storage.removeItem(key)));

    await AsyncStorage.clear();

    await ImageCacheManager.clearCache();
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await apiClient.auth.login.post({ email, password });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.failedToSignIn')));
      }

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user as unknown as User);
      setNeedsReauth(false);
      redirect(redirectTo);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);

      await GoogleSignin.hasPlayServices();
      const _userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        throw new Error(t('auth.noIdTokenFromGoogle'));
      }

      const { data, error } = await apiClient.auth.google.post({ idToken });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.failedToSignInWithGoogle')));
      }

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user as unknown as User);
      setNeedsReauth(false);
      redirect(redirectTo);
    } catch (error) {
      setIsLoading(false);

      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log(t('auth.userCancelledLogin'));
      } else if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
        console.log(t('auth.signInInProgress'));
      } else if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log(t('auth.playServicesNotAvailable'));
      } else {
        console.error('Google sign in error:', error);
      }

      throw error;
    }
  };

  const signInWithApple = async () => {
    try {
      setIsLoading(true);

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error(t('auth.appleSignInNotAvailable'));
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { data, error } = await apiClient.auth.apple.post({
        identityToken: credential.identityToken ?? '',
        authorizationCode: credential.authorizationCode ?? '',
      });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.failedToSignInWithApple')));
      }

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user as unknown as User);
      setNeedsReauth(false);
      redirect(redirectTo);
    } catch (error) {
      console.error('Apple sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
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
      const { error } = await apiClient.auth.register.post({
        email,
        password,
        firstName,
        lastName,
      });
      if (error) {
        throw new Error(extractAuthError(error.value, t('auth.registrationFailed')));
      }
    } catch (error) {
      console.error('Registration error:', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      if (refreshToken) {
        await apiClient.auth.logout.post({ refreshToken });
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
      const { data, error } = await apiClient.auth['forgot-password'].post({ email });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.failedToProcessRequest')));
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
      const { data, error } = await apiClient.auth['reset-password'].post({
        email,
        code,
        newPassword,
      });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.resetPasswordFailed')));
      }
      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    try {
      const { data, error } = await apiClient.auth['verify-email'].post({ email, code });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.failedToVerifyEmail')));
      }

      if (data.accessToken && data.refreshToken && data.user) {
        await Storage.setItem('access_token', data.accessToken);
        await Storage.setItem('refresh_token', data.refreshToken);
        await setToken(data.accessToken);
        await setRefreshToken(data.refreshToken);
        userStore.set(data.user as unknown as User);
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
      const { data, error } = await apiClient.auth['resend-verification'].post({ email });
      if (error || !data) {
        throw new Error(extractAuthError(error?.value, t('auth.failedToResendVerificationEmail')));
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
      const { error } = await apiClient.auth.delete();
      if (error) {
        throw new Error(String(error.value ?? t('auth.failedToDeleteAccount')));
      }

      setToken(null);
      setRefreshToken(null);
      await clearLocalData();
      await Updates.reloadAsync();
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
