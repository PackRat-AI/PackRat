import { when } from '@legendapp/state';
import { WEIGHT_UNITS } from '@packrat/constants';
import { clientEnvs } from '@packrat/env/expo-client';
import { asBoolean, asString } from '@packrat/guards';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';
import { userStore, userSyncState } from 'expo-app/features/auth/store';
import { authClient } from 'expo-app/lib/auth-client';
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const AUTH_VERSION_KEY = 'auth_version';
const CURRENT_AUTH_VERSION = 'v2';

async function runVersionGateMigration() {
  const authVersion = await AsyncStorage.getItem(AUTH_VERSION_KEY);
  if (authVersion === CURRENT_AUTH_VERSION) return;

  // Clear legacy integer-ID tokens from v1 auth system
  await Storage.removeItem('access_token');
  await Storage.removeItem('refresh_token');
  await AsyncStorage.setItem(AUTH_VERSION_KEY, CURRENT_AUTH_VERSION);
}

function applySessionUser(sessionUser: Record<string, unknown>) {
  const name = asString(sessionUser.name) ?? '';
  const userId = asString(sessionUser.id) ?? '';
  const email = asString(sessionUser.email) ?? '';

  // Keep Sentry user identity in sync with the session.
  Sentry.setUser({ id: userId, email, username: name });

  // Better Auth's getSession() may not return additionalFields (e.g. avatarUrl,
  // firstName, lastName) if the session was created before those fields were
  // added or if the client doesn't request them. Preserve existing persisted
  // values for those fields rather than overwriting with null.
  const existingUser = userStore.get();

  userStore.set({
    id: asString(sessionUser.id) ?? '',
    email: asString(sessionUser.email) ?? '',
    firstName:
      asString(sessionUser.firstName) ??
      (name.split(' ')[0] || undefined) ??
      existingUser?.firstName ??
      '',
    lastName:
      asString(sessionUser.lastName) ??
      (name.split(' ').slice(1).join(' ') || undefined) ??
      existingUser?.lastName ??
      '',
    role: asString(sessionUser.role) ?? existingUser?.role ?? 'USER',
    emailVerified: asBoolean(sessionUser.emailVerified) ?? null,
    avatarUrl:
      asString(sessionUser.avatarUrl) ??
      asString(sessionUser.image) ??
      existingUser?.avatarUrl ??
      null,
    createdAt: asString(sessionUser.createdAt) ?? existingUser?.createdAt ?? null,
    updatedAt: asString(sessionUser.updatedAt) ?? existingUser?.updatedAt ?? null,
    preferredWeightUnit:
      (WEIGHT_UNITS.includes(sessionUser.preferredWeightUnit as never)
        ? (sessionUser.preferredWeightUnit as import('@packrat/constants').WeightUnit)
        : undefined) ??
      existingUser?.preferredWeightUnit ??
      'g',
  });
}

function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 401 || status === 403;
}

export function useAuthInit() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: clientEnvs.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: Platform.OS === 'ios' ? clientEnvs.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID : undefined,
      offlineAccess: false,
      hostedDomain: '',
      forceCodeForRefreshToken: true,
      accountName: '',
      scopes: ['profile', 'email'],
    });
  }, []);

  useEffect(() => {
    const navigate = (target: Parameters<typeof router.replace>[0]) => {
      // On web, expo-router's navigationRef may not be ready yet during
      // Strict Mode double-mount — defer by one event loop tick.
      if (Platform.OS === 'web') {
        setTimeout(() => router.replace(target), 0);
      } else {
        router.replace(target);
      }
    };

    const initializeAuth = async () => {
      await runVersionGateMigration();

      // Wait for SQLite persist to hydrate userStore before reading cached user
      await when(userSyncState.isPersistLoaded);

      const cachedUser = userStore.get();
      const hasSkippedLogin = await AsyncStorage.getItem('skipped_login');

      if (cachedUser || hasSkippedLogin === 'true') {
        // Unblock UI immediately — the app is offline-first
        setIsLoading(false);

        // Guests have no session to refresh; skip the check entirely
        if (!cachedUser) return;

        // Refresh session in the background; only sign out on a definitive auth
        // rejection (401/403), never on network failures (user may be offline)
        authClient
          .getSession()
          .then(({ data: session, error }) => {
            if (error) {
              if (isDefinitiveAuthFailure(error)) {
                Sentry.addBreadcrumb({
                  category: 'auth',
                  message: 'Background session refresh: definitive auth failure',
                  level: 'warning',
                  data: { status: (error as { status?: number })?.status },
                });
                Sentry.setUser(null);
                userStore.set(null);
                router.replace('/auth');
              }
              return;
            }
            if (session?.user) {
              // safe-cast: widening Better Auth User to Record<string, unknown> for runtime additional-field access
              applySessionUser(session.user as Record<string, unknown>);
            } else {
              // Server confirmed the session is gone
              Sentry.addBreadcrumb({
                category: 'auth',
                message: 'Background session refresh: session expired',
                level: 'info',
              });
              Sentry.setUser(null);
              userStore.set(null);
              router.replace('/auth');
            }
          })
          .catch((error) => {
            if (isDefinitiveAuthFailure(error)) {
              Sentry.setUser(null);
              userStore.set(null);
              router.replace('/auth');
            }
            // Network/transient error — keep cached user silently
          });
        return;
      }

      // No cached user — must reach the server to establish a session
      try {
        const { data: session, error } = await authClient
          .getSession()
          .catch((err) => ({ data: null, error: err as unknown }));

        if (!error && session?.user) {
          // safe-cast: widening Better Auth User to Record<string, unknown> for runtime additional-field access
          applySessionUser(session.user as Record<string, unknown>);
          return;
        }

        navigate({
          pathname: '/auth',
          params: { showSkipLoginBtn: 'true', redirectTo: '/' },
        });
      } catch (error) {
        Sentry.captureException(error, { tags: { auth_action: 'init' } });
        console.error('Failed to initialize auth:', error);
        navigate('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  return isLoading;
}
