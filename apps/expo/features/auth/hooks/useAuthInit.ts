import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isAuthed } from '../store';

export function useAuthInit() {
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Google Sign-In
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

  // Check for existing session or skipped login on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Check if user has skipped login before
        const hasSkippedLogin = await AsyncStorage.getItem('skipped_login');

        // Get stored token
        const accessToken = await SecureStore.getItemAsync('access_token');

        // If user has session or hasSkippedLogin before, continue to app
        if (accessToken || hasSkippedLogin === 'true') {
          if (accessToken) isAuthed.set(true);
          setIsLoading(false);
          return;
        } else {
          // No tokens and hasn't skipped login. It's first time - show auth screen
          router.replace({
            pathname: '/auth',
            params: { showSkipLoginBtn: 'true', redirectTo: '/' },
          });
        }
      } catch (error) {
        console.error('Failed to load user session:', error);
        router.replace('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [setIsLoading]);

  return isLoading;
}
