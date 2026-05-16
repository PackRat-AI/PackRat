import { clientEnvs } from '@packrat/env/expo-client';
import { asBoolean, asString } from '@packrat/guards';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { userStore } from 'expo-app/features/auth/store';
import type { User } from 'expo-app/features/profile/types';
import { authClient } from 'expo-app/lib/auth-client';
import { t } from 'expo-app/lib/i18n';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { queryClient } from 'expo-app/providers/TanstackProvider';
import * as AppleAuthentication from 'expo-apple-authentication';
import { type Href, router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  isLoadingAtom,
  needsReauthAtom,
  redirectToAtom,
  suppressSignOutNavAtom,
} from '../atoms/authAtoms';

function redirect(route: string) {
  try {
    const parsedRoute: Href = JSON.parse(route);
    return router.dismissTo(parsedRoute);
  } catch {
    router.dismissTo(route as Href); // safe-cast: Href = string | HrefObject; string literal branch failed JSON.parse so plain string is the correct type here
  }
}

function mapToUser(raw: Record<string, unknown>): User {
  const name = asString(raw.name) ?? '';
  const spaceIdx = name.indexOf(' ');
  return {
    id: asString(raw.id) ?? '',
    email: asString(raw.email) ?? '',
    firstName: spaceIdx >= 0 ? name.slice(0, spaceIdx) : name,
    lastName: spaceIdx >= 0 ? name.slice(spaceIdx + 1) : '',
    role: asString(raw.role) ?? 'USER',
    emailVerified: asBoolean(raw.emailVerified) ?? null,
    avatarUrl: asString(raw.image) ?? null,
    createdAt: asString(raw.createdAt) ?? null,
    updatedAt: asString(raw.updatedAt) ?? null,
    preferredWeightUnit: (raw.preferredWeightUnit as User['preferredWeightUnit']) ?? 'g',
  };
}

export function useAuthActions() {
  const setIsLoading = useSetAtom(isLoadingAtom);
  const redirectTo = useAtomValue(redirectToAtom);
  const setNeedsReauth = useSetAtom(needsReauthAtom);
  const setSuppressSignOutNav = useSetAtom(suppressSignOutNavAtom);

  const clearLocalData = async () => {
    queryClient.clear();
    const allKeys = await Storage.getAllKeys();
    await Promise.all(allKeys.map((key) => Storage.removeItem(key)));
    await AsyncStorage.clear();
    await ImageCacheManager.clearCache();
  };

  const applySession = (user: Record<string, unknown>) => {
    userStore.set(mapToUser(user));
    setNeedsReauth(false);
    redirect(redirectTo);
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message ?? 'Sign in failed');
      applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) throw new Error(t('auth.noIdTokenFromGoogle'));

      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        idToken: { token: idToken },
      });
      if (error) throw new Error(error.message ?? t('auth.failedToSignInWithGoogle'));
      if (data && 'user' in data && data.user) applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
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
    setIsLoading(true);
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) throw new Error(t('auth.appleSignInNotAvailable'));

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { data, error } = await authClient.signIn.social({
        provider: 'apple',
        idToken: { token: credential.identityToken ?? '' },
      });
      if (error) throw new Error(error.message ?? 'Apple sign in failed');
      if (data && 'user' in data && data.user) applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
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
      const name = [firstName, lastName].filter(Boolean).join(' ') || email;
      const { error } = await authClient.signUp.email({ email, password, name });
      if (error) throw new Error(error.message ?? 'Sign up failed');
    } catch (error) {
      console.error('Registration error:', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // Suppress AppLayout's auto-navigation to /auth so the profile screen can
    // show a post-sign-out prompt and handle navigation itself.
    setSuppressSignOutNav(true);
    setIsLoading(true);
    try {
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) await GoogleSignin.signOut();
      await authClient.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      userStore.set(null);
      await clearLocalData();
      setNeedsReauth(false);
      // isLoadingAtom intentionally left true — the caller (profile/handleSignOut)
      // shows a post-sign-out Alert and is responsible for clearing it and
      // navigating (either to '/' for guest mode or to /auth via releasing
      // suppressSignOutNav while isLoadingAtom is still true).
    }
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Forgot password failed');
    }
  };

  const resetPassword = async (email: string, opts: { token: string; newPassword: string }) => {
    const res = await fetch(`${clientEnvs.EXPO_PUBLIC_API_URL}/api/password-reset/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: opts.token, newPassword: opts.newPassword }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Reset password failed');
    }
  };

  const verifyEmail = async (_email: string, token: string) => {
    const { data, error } = await authClient.verifyEmail({ query: { token } });
    if (error) throw new Error(error.message ?? 'Email verification failed');

    const session = await authClient.getSession();
    if (session.data?.user) {
      applySession(session.data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
    }
    return data;
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: 'packrat://verify-email',
    });
    if (error) throw new Error(error.message ?? 'Failed to resend verification email');
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    try {
      const { error } = await authClient.deleteUser();
      if (error) throw new Error(error.message ?? 'Delete account failed');
      userStore.set(null);
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
