import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { AxiosError } from 'axios';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { userStore } from 'expo-app/features/auth/store';
import { packItemsStore, packsStore } from 'expo-app/features/packs/store';
import { packWeigthHistoryStore } from 'expo-app/features/packs/store/packWeightHistory';
import axiosInstance from 'expo-app/lib/api/client';
import { t } from 'expo-app/lib/i18n';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import * as AppleAuthentication from 'expo-apple-authentication';
import { type Href, router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
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

export function useAuthActions() {
  const setToken = useSetAtom(tokenAtom);
  const setRefreshToken = useSetAtom(refreshTokenAtom);
  const refreshToken = useAtomValue(refreshTokenAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const redirectTo = useAtomValue(redirectToAtom);
  const setNeedsReauth = useSetAtom(needsReauthAtom);

  const clearLocalData = async () => {
    // Clear state
    await setToken(null);
    await setRefreshToken(null);
    packsStore.set({});
    packItemsStore.set({});
    userStore.set(null);
    packWeigthHistoryStore.set({});
    ImageCacheManager.clearCache();
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToSignIn'));
      }

      console.log(data.accessToken, data.refreshToken);

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user);

      // Reset re-authentication state
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

      // Check if user is already signed in to Google
      await GoogleSignin.hasPlayServices();

      // Sign in with Google
      const _userInfo = await GoogleSignin.signIn();

      // Get the ID token
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        throw new Error(t('auth.noIdTokenFromGoogle'));
      }

      // Send the token to backend
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToSignInWithGoogle'));
      }

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user);

      // Reset re-authentication state
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

      // Send the identity token to your backend
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToSignInWithApple'));
      }

      await setToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      userStore.set(data.user);

      // Reset re-authentication state
      setNeedsReauth(false);

      redirect(redirectTo);
    } catch (error) {
      console.error('Apple sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      // Sign out from Google if signed in
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      // Get the refresh token
      if (refreshToken) {
        // Call the logout endpoint to revoke the refresh token
        await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      }

      clearLocalData();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setNeedsReauth(false);
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      const response = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('auth.failedToVerifyEmail'));
      }

      // If verification is successful, set the user and tokens
      if (data.accessToken && data.refreshToken && data.user) {
        await Storage.setItem('access_token', data.accessToken);
        await Storage.setItem('refresh_token', data.refreshToken);

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
          headers: {
            'Content-Type': 'application/json',
          },
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

      // Clear tokens and user data
      await clearLocalData();
      router.replace('/');
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
