import { clientEnvs } from '@packrat/env/expo-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { userStore } from 'expo-app/features/auth/store';
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
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        await runVersionGateMigration();

        const hasSkippedLogin = await AsyncStorage.getItem('skipped_login');
        const { data: session } = await authClient.getSession();

        if (session?.user) {
          userStore.set({
            id: session.user.id,
            email: session.user.email,
            firstName: session.user.name?.split(' ')[0] ?? '',
            lastName: session.user.name?.split(' ').slice(1).join(' ') ?? '',
            role: ((session.user as Record<string, unknown>).role as 'USER' | 'ADMIN') ?? 'USER', // safe-cast: Better Auth client type omits additionalFields; role is present at runtime
            avatarUrl: session.user.image ?? null,
            preferredWeightUnit: 'g',
          });
          setIsLoading(false);
          return;
        }

        if (hasSkippedLogin === 'true') {
          setIsLoading(false);
          return;
        }

        router.replace({
          pathname: '/auth',
          params: { showSkipLoginBtn: 'true', redirectTo: '/' },
        });
      } catch (error) {
        console.error('Failed to load user session:', error);
        router.replace('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  return isLoading;
}
