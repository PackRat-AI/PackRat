import { asBoolean, asString } from '@packrat/guards';
import { safeJsonParse } from '@packrat/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';
import { AuthClientError, toAuthError } from 'expo-app/features/auth/lib/authErrors';
import { userStore } from 'expo-app/features/auth/store';
import type { User } from 'expo-app/features/profile/types';
import * as AppleAuthentication from 'expo-app/lib/appleAuthentication';
import { authClient } from 'expo-app/lib/auth-client';
import { t } from 'expo-app/lib/i18n';
import * as Updates from 'expo-app/lib/updates';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { queryClient } from 'expo-app/providers/TanstackProvider';
import { type Href, router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  isLoadingAtom,
  isSignOutRedirectingAtom,
  needsReauthAtom,
  redirectToAtom,
  suppressSignOutNavAtom,
} from '../atoms/authAtoms';

function redirect(route: string) {
  try {
    const parsedRoute = safeJsonParse<Href>(route, { strict: true });
    return router.replace(parsedRoute);
  } catch {
    router.replace(route as Href); // safe-cast: Href = string | HrefObject; string literal branch failed JSON.parse so plain string is the correct type here
  }
}

function mapToUser(raw: Record<string, unknown>): User {
  const name = asString(raw.name) ?? '';
  const spaceIdx = name.indexOf(' ');
  // Prefer explicit firstName/lastName additionalFields from Better Auth over
  // splitting the combined name field, which may be stale after a profile update.
  const firstName = asString(raw.firstName) ?? (spaceIdx >= 0 ? name.slice(0, spaceIdx) : name);
  const lastName = asString(raw.lastName) ?? (spaceIdx >= 0 ? name.slice(spaceIdx + 1) : '');
  return {
    id: asString(raw.id) ?? '',
    email: asString(raw.email) ?? '',
    firstName,
    lastName,
    role: asString(raw.role) ?? 'USER',
    emailVerified: asBoolean(raw.emailVerified) ?? null,
    avatarUrl: asString(raw.avatarUrl) ?? asString(raw.image) ?? null,
    createdAt: asString(raw.createdAt) ?? null,
    updatedAt: asString(raw.updatedAt) ?? null,
    preferredWeightUnit: (raw.preferredWeightUnit as User['preferredWeightUnit']) ?? 'g',
  };
}

export function useAuthActions() {
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setIsSignOutRedirecting = useSetAtom(isSignOutRedirectingAtom);
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
    setIsSignOutRedirecting(false);
    redirect(redirectTo);
  };

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    setIsLoading(true);
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Email sign in attempt',
      level: 'info',
      data: { emailDomain: email.split('@')[1] },
    });
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) throw toAuthError({ source: error, fallback: 'Sign in failed' });
      applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
      Sentry.addBreadcrumb({ category: 'auth', message: 'Email sign in succeeded', level: 'info' });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_method: 'email', auth_action: 'sign_in' },
        extra: {
          ...(error instanceof AuthClientError
            ? { httpStatus: error.status, errorCode: error.code }
            : {}),
        },
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
      if (error) throw toAuthError({ source: error, fallback: t('auth.failedToSignInWithGoogle') });
      if (data && 'user' in data && data.user) {
        applySession(data.user as Record<string, unknown>); // safe-cast: Better Auth user type omits additionalFields; role/preferredWeightUnit present at runtime
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Google sign in succeeded',
          level: 'info',
        });
      }
    } catch (error) {
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
          extra:
            error instanceof AuthClientError
              ? { httpStatus: error.status, errorCode: error.code }
              : {},
        });
        console.error('Google sign in error:', error);
      }
      throw error;
    } finally {
      setIsLoading(false);
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
      if (error) throw toAuthError({ source: error, fallback: 'Apple sign in failed' });
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
        extra:
          error instanceof AuthClientError
            ? { httpStatus: error.status, errorCode: error.code }
            : {},
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
      data: {
        emailDomain: email.split('@')[1],
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
      },
    });
    try {
      const name = [firstName, lastName].filter(Boolean).join(' ') || email;
      const { error } = await authClient.signUp.email({ email, password, name });
      if (error) throw toAuthError({ source: error, fallback: 'Sign up failed' });
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Email sign up succeeded',
        level: 'info',
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_method: 'email', auth_action: 'sign_up' },
        extra: {
          ...(error instanceof AuthClientError
            ? { httpStatus: error.status, errorCode: error.code }
            : {}),
        },
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
    setIsSignOutRedirecting(true);
    setIsLoading(true);
    Sentry.addBreadcrumb({ category: 'auth', message: 'Sign out initiated', level: 'info' });
    try {
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) await GoogleSignin.signOut();
      await authClient.signOut();
      // Clear user identity from Sentry on sign-out.
      Sentry.setUser(null);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_action: 'sign_out' },
        extra:
          error instanceof AuthClientError
            ? { httpStatus: error.status, errorCode: error.code }
            : {},
      });
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
      data: { emailDomain: email.split('@')[1] },
    });
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: 'packrat://reset-password',
    });
    if (error) {
      const err = toAuthError({ source: error, fallback: 'Forgot password failed' });
      Sentry.captureException(err, {
        tags: { auth_action: 'forgot_password' },
        extra: { httpStatus: error.status, errorCode: error.code },
      });
      throw err;
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
      const err = toAuthError({ source: error, fallback: 'Reset password failed' });
      Sentry.captureException(err, {
        tags: { auth_action: 'reset_password' },
        extra: { httpStatus: error.status, errorCode: error.code },
      });
      throw err;
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
      const err = toAuthError({ source: error, fallback: 'Email verification failed' });
      Sentry.captureException(err, {
        tags: { auth_action: 'verify_email' },
        extra: { httpStatus: error.status, errorCode: error.code },
      });
      throw err;
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
      data: { emailDomain: email.split('@')[1] },
    });
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: 'packrat://verify-email',
    });
    if (error) {
      const err = toAuthError({ source: error, fallback: 'Failed to resend verification email' });
      Sentry.captureException(err, {
        tags: { auth_action: 'resend_verification' },
        extra: { httpStatus: error.status, errorCode: error.code },
      });
      throw err;
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Account deletion initiated',
      level: 'warning',
    });
    try {
      const { error } = await authClient.deleteUser();
      if (error) throw toAuthError({ source: error, fallback: 'Delete account failed' });
      Sentry.setUser(null);
      userStore.set(null);
      await clearLocalData();
      await Updates.reloadAsync();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { auth_action: 'delete_account' },
        extra:
          error instanceof AuthClientError
            ? { httpStatus: error.status, errorCode: error.code }
            : {},
      });
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
