import type { AlertRef } from '@packrat/ui/nativewindui';
import { ActivityIndicator, AlertAnchor, Button, Text } from '@packrat/ui/nativewindui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureFlags } from 'expo-app/config';
import { redirectToAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSetAtom } from 'jotai';
import * as React from 'react';
import { Image, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOGO_SOURCE = require('expo-app/assets/packrat-app-icon-gradient.png');

const GOOGLE_SOURCE = {
  uri: 'https://www.pngall.com/wp-content/uploads/13/Google-Logo.png',
};

type RouteParams = {
  redirectTo: string;
  showSignInCopy?: string;
  showSkipLoginBtn?: string;
};

export default function AuthIndexScreen() {
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();
  const { t } = useTranslation();
  const alertRef = React.useRef<AlertRef>(null);
  const {
    redirectTo = '/',
    showSignInCopy,
    showSkipLoginBtn,
  } = useLocalSearchParams<RouteParams>();
  const handleSkipLogin = async () => {
    await AsyncStorage.setItem('skipped_login', 'true');
    router.replace('/');
  };

  const setRedirectTo = useSetAtom(redirectToAtom);

  React.useEffect(() => {
    setRedirectTo(redirectTo as string);
  }, [redirectTo, setRedirectTo]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="ios:justify-end flex-1 justify-center gap-4 px-8 py-4">
          <View className="items-center">
            <Image
              source={LOGO_SOURCE}
              className="ios:h-12 ios:w-12 h-8 w-8 rounded-md"
              resizeMode="contain"
            />
          </View>
          <View className="ios:pb-5 ios:pt-2 pb-2">
            {showSignInCopy === 'true' ? (
              <Text className="ios:font-extrabold text-center text-3xl font-medium">
                {t('auth.loginRequired')}
              </Text>
            ) : (
              <>
                <Text className="ios:font-extrabold text-center text-3xl font-medium">
                  {t('auth.braceYourself')}
                </Text>
                <Text className="ios:font-extrabold text-center text-3xl font-medium">
                  {t('auth.forWhatsNext')}
                </Text>
              </>
            )}
            {showSignInCopy && (
              <Text className="pt-4 text-center text-muted-foreground">
                {t('auth.signInMessage')}
              </Text>
            )}
          </View>
          <Link href="/auth/(create-account)" asChild>
            <Button size={Platform.select({ ios: 'lg', default: 'md' })}>
              <Text>{t('auth.signUpFree')}</Text>
            </Button>
          </Link>
          {featureFlags.enableOAuth && (
            <>
              <Button
                variant="secondary"
                className="ios:border-foreground/60"
                size={Platform.select({ ios: 'lg', default: 'md' })}
                onPress={signInWithGoogle}
              >
                <Image
                  source={GOOGLE_SOURCE}
                  className="absolute left-4 h-4 w-4"
                  resizeMode="contain"
                />
                <Text className="ios:text-foreground">{t('auth.continueWithGoogle')}</Text>
              </Button>
              {Platform.OS === 'ios' && (
                <Button
                  variant="secondary"
                  className="ios:border-foreground/60"
                  size={Platform.select({ ios: 'lg', default: 'md' })}
                  onPress={signInWithApple}
                >
                  <Text className="ios:text-foreground absolute left-4 text-[22px]"></Text>
                  <Text className="ios:text-foreground">{t('auth.continueWithApple')}</Text>
                </Button>
              )}
            </>
          )}
          <Link href={'/auth/(login)'} asChild>
            <Button
              variant={showSkipLoginBtn === 'true' ? 'tonal' : 'plain'}
              size={Platform.select({ ios: 'lg', default: 'md' })}
            >
              <Text className="text-primary">{t('auth.signIn')}</Text>
            </Button>
          </Link>

          {showSkipLoginBtn === 'true' && (
            <Button
              variant="plain"
              size={Platform.select({ ios: 'lg', default: 'md' })}
              onPress={handleSkipLogin}
              className="mt-2"
            >
              <Text>{t('auth.continueWithout')}</Text>
            </Button>
          )}
        </View>
      </SafeAreaView>
      <AlertAnchor ref={alertRef} />
    </>
  );
}
