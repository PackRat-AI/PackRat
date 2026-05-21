import { asBoolean, asString } from '@packrat/guards';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';
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
    const mappedUser = mapToUser(user);
    userStore.set(mappedUser);

    // Identify the user in Sentry so all subsequent events are tagged.
    Sentry.setUser({
      id: mappedUser.id,
      email: mappedUser.email,
      username: `${mappedUser.firstName} ${mappedUser.lastName}`.trim(),
    });

    setNeedsReauth(false);
    redirect(redirectTo);
  };

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    setIsLoading(true);
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Email sign in attempt',
      level: 'info',
      data: { email },
    });
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message ?? 'Sign in failed');
      applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
      Sentry.addBreadcrumb({ category: 'auth', message: 'Email sign in succeeded', level: 'info' });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_method: 'email', auth_action: 'sign_in' },
        extra: { email },
      });
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    Sentry.addBreadcrumb({ category: 'auth', message: 'Google sign in attempt', level: 'info' });
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
      if (data && 'user' in data && data.user) {
        applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Google sign in succeeded',
          level: 'info',
        });
      }
    } catch (error) {
      setIsLoading(false);

      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Google sign in cancelled by user',
          level: 'info',
        });
        console.log(t('auth.userCancelledLogin'));
      } else if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Google sign in already in progress',
          level: 'warning',
        });
        console.log(t('auth.signInInProgress'));
      } else if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Sentry.captureException(error, {
          tags: { auth_method: 'google', auth_action: 'sign_in', error_type: 'play_services' },
        });
        console.log(t('auth.playServicesNotAvailable'));
      } else {
        Sentry.captureException(error, {
          tags: { auth_method: 'google', auth_action: 'sign_in' },
        });
        console.error('Google sign in error:', error);
      }
      throw error;
    }
  };

  const signInWithApple = async () => {
    setIsLoading(true);
    Sentry.addBreadcrumb({ category: 'auth', message: 'Apple sign in attempt', level: 'info' });
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
      if (data && 'user' in data && data.user) {
        applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Apple sign in succeeded',
          level: 'info',
        });
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_method: 'apple', auth_action: 'sign_in' },
      });
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
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Email sign up attempt',
      level: 'info',
      data: { email, hasFirstName: !!firstName, hasLastName: !!lastName },
    });
    try {
      const name = [firstName, lastName].filter(Boolean).join(' ') || email;
      const { error } = await authClient.signUp.email({ email, password, name });
      if (error) throw new Error(error.message ?? 'Sign up failed');
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Email sign up succeeded',
        level: 'info',
        data: { email },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_method: 'email', auth_action: 'sign_up' },
        extra: { email },
      });
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
    Sentry.addBreadcrumb({ category: 'auth', message: 'Sign out initiated', level: 'info' });
    try {
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) await GoogleSignin.signOut();
      await authClient.signOut();
      // Clear user identity from Sentry on sign-out.
      Sentry.setUser(null);
    } catch (error) {
      Sentry.captureException(error, { tags: { auth_action: 'sign_out' } });
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
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Password reset requested',
      level: 'info',
      data: { email },
    });
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: 'packrat://reset-password',
    });
    if (error) {
      Sentry.captureException(new Error(error.message ?? 'Forgot password failed'), {
        tags: { auth_action: 'forgot_password' },
        extra: { email },
      });
      throw new Error(error.message ?? 'Forgot password failed');
    }
  };

  const resetPassword = async ({
    opts,
  }: {
    email?: string;
    opts: { token: string; newPassword: string };
  }) => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Password reset submitted',
      level: 'info',
    });
    const { error } = await authClient.resetPassword({
      token: opts.token,
      newPassword: opts.newPassword,
    });
    if (error) {
      Sentry.captureException(new Error(error.message ?? 'Reset password failed'), {
        tags: { auth_action: 'reset_password' },
      });
      throw new Error(error.message ?? 'Reset password failed');
    }
  };

  const verifyEmail = async ({ token }: { _email?: string; token: string }) => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Email verification submitted',
      level: 'info',
    });
    const { data, error } = await authClient.verifyEmail({ query: { token } });
    if (error) {
      Sentry.captureException(new Error(error.message ?? 'Email verification failed'), {
        tags: { auth_action: 'verify_email' },
      });
      throw new Error(error.message ?? 'Email verification failed');
    }

    const session = await authClient.getSession();
    if (session.data?.user) {
      applySession(session.data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
    }
    return data;
  };

  const resendVerificationEmail = async (email: string) => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Verification email resend requested',
      level: 'info',
      data: { email },
    });
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: 'packrat://verify-email',
    });
    if (error) {
      Sentry.captureException(new Error(error.message ?? 'Failed to resend verification email'), {
        tags: { auth_action: 'resend_verification' },
        extra: { email },
      });
      throw new Error(error.message ?? 'Failed to resend verification email');
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    Sentry.addBreadcrumb({ category: 'auth', message: 'Account deletion initiated', level: 'warning' });
    try {
      const { error } = await authClient.deleteUser();
      if (error) throw new Error(error.message ?? 'Delete account failed');
      Sentry.setUser(null);
      userStore.set(null);
      await clearLocalData();
      await Updates.reloadAsync();
    } catch (error) {
      Sentry.captureException(error, { tags: { auth_action: 'delete_account' } });
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
