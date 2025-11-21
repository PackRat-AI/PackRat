import type { AlertRef } from '@packrat/ui/nativewindui';
import { ActivityIndicator, AlertAnchor, Button, Text, TextField } from '@packrat/ui/nativewindui';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuthActions } from 'expo-app/features/auth/hooks/useAuthActions';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  Alert,
  Image,
  Keyboard,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  type TextInputFocusEventData,
  type TextInputKeyPressEventData,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardController } from 'react-native-keyboard-controller';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LOGO_SOURCE = require('expo-app/assets/packrat-app-icon-gradient.png');

const COUNTDOWN_SECONDS_TO_RESEND_CODE = 60;
const NUM_OF_CODE_CHARACTERS = 5;
const SCREEN_OPTIONS = {
  headerBackTitle: 'Back',
  headerTransparent: true,
  title: '',
};

export default function OneTimePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [countdown, setCountdown] = React.useState(COUNTDOWN_SECONDS_TO_RESEND_CODE);
  const [codeValues, setCodeValues] = React.useState(Array(NUM_OF_CODE_CHARACTERS).fill(''));
  const [errorIndexes, setErrorIndexes] = React.useState<number[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const alertRef = React.useRef<AlertRef>(null);
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ email: string; mode: string }>();
  const email = params.email || '';
  const mode = params.mode || 'verification';
  const { verifyEmail, forgotPassword, resendVerificationEmail } = useAuthActions();

  const countdownInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);

  function startCountdown() {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    setCountdown(COUNTDOWN_SECONDS_TO_RESEND_CODE);
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: need to run this on initial render
  React.useEffect(() => {
    startCountdown();

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  async function resendCode() {
    try {
      setIsLoading(true);

      if (mode === 'reset-password') {
        await forgotPassword(email);
      } else {
        await resendVerificationEmail(email);
      }

      // Reset countdown
      startCountdown();

      // Clear current code values
      setCodeValues(Array(NUM_OF_CODE_CHARACTERS).fill(''));
      setErrorIndexes([]);

      Alert.alert(t('common.success'), t('auth.verificationCodeResent'));
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('auth.failedToResendCode'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Handles both email verification for new accounts and password reset modes
  async function onSubmit() {
    const errorIndexes = codeValues
      .map((str, index) => (str === '' ? index : -1))
      .filter((index) => index !== -1);

    if (errorIndexes.length > 0) {
      setErrorIndexes(errorIndexes);
      alertRef.current?.alert({
        title: t('common.error'),
        message: t('auth.enterCompleteCode'),
        buttons: [{ text: t('common.ok') }],
      });
      return;
    }

    setErrorIndexes([]);
    setIsLoading(true);

    try {
      const code = codeValues.join('');

      if (mode === 'reset-password') {
        // Navigate to reset password screen with email and code
        router.push({
          pathname: '/auth/reset-password',
          params: { email, code },
        });
      } else {
        await verifyEmail(email, code); // Navigation is handled in the function
      }
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('auth.invalidVerificationCode'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-1 px-8"
        style={{ paddingBottom: insets.bottom, paddingTop: headerHeight }}
        extraKeyboardSpace={-insets.bottom + 12}
      >
        <View className="flex-1 justify-center gap-3">
          <View className="items-center pb-1">
            <Image source={LOGO_SOURCE} className="h-10 w-10 rounded-md" resizeMode="contain" />
          </View>
          <View className="gap-1">
            <Text variant="title1" className="text-center font-semibold">
              {mode === 'reset-password' ? t('auth.resetPassword') : t('auth.verifyYourEmail')}
            </Text>
            <Text variant="subhead" className="text-center">
              {t('auth.weSentCodeTo')}{' '}
              <Text variant="subhead" className="font-semibold">
                {email}
              </Text>
            </Text>
          </View>
          <View className="flex-row justify-between gap-2 py-3">
            {codeValues.map((value, index) => (
              <OTPField
                // biome-ignore lint/suspicious/noArrayIndexKey: really no definite id here. code values could repeat.
                key={index}
                index={index}
                value={value}
                codeValues={codeValues}
                setCodeValues={setCodeValues}
                isLoading={isLoading}
                onSubmit={onSubmit}
                hasError={errorIndexes.includes(index)}
              />
            ))}
          </View>
          <Animated.View className="flex-row justify-center gap-0.5">
            <Animated.View layout={Platform.select({ ios: LinearTransition })}>
              <Text variant="caption1" className="text-center font-medium opacity-70">
                {t('auth.didntReceiveCode')}{' '}
              </Text>
            </Animated.View>
            {countdown > 0 ? (
              <Animated.View
                key="resend-in"
                entering={Platform.select({ ios: FadeIn })}
                layout={Platform.select({ ios: LinearTransition })}
              >
                <Text variant="caption1" className="font-normal opacity-70">
                  {t('auth.resendIn', { countdown, plural: countdown > 1 ? 's' : '' })}
                </Text>
              </Animated.View>
            ) : (
              <Animated.View
                key="resend"
                entering={Platform.select({ ios: FadeIn.duration(500) })}
                layout={Platform.select({ ios: LinearTransition })}
              >
                <Pressable className="active:opacity-70" onPress={resendCode} disabled={isLoading}>
                  <Text className="text-xs font-semibold opacity-90">{t('auth.resend')}</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        </View>
        <Button size="lg" onPress={onSubmit} disabled={isLoading}>
          {isLoading ? (
            <View className="py-1">
              <ActivityIndicator color="white" />
            </View>
          ) : (
            <Text>{t('auth.continue')}</Text>
          )}
        </Button>
      </KeyboardAwareScrollView>
      <AlertAnchor ref={alertRef} />
    </>
  );
}

const OTP_FIELD_SELECTION = { start: 0, end: 1 };

type OTPFieldProps = {
  index: number;
  value: string;
  codeValues: string[];
  setCodeValues: React.Dispatch<React.SetStateAction<string[]>>;
  isLoading: boolean;
  onSubmit: () => void;
  hasError: boolean;
};

function OTPField({
  index,
  value,
  codeValues,
  setCodeValues,
  isLoading,
  onSubmit,
  hasError,
}: OTPFieldProps) {
  const { colors } = useColorScheme();

  function onKeyPress({ nativeEvent }: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (nativeEvent.key === 'Backspace' && value === '') {
      KeyboardController.setFocusTo('prev');
    }
    if (value === nativeEvent.key) {
      KeyboardController.setFocusTo('next');
    }
  }

  function onFocus(e: NativeSyntheticEvent<TextInputFocusEventData>) {
    e.currentTarget.setNativeProps({
      selection: { start: 0, end: value?.toString().length },
    });
  }

  function onChangeText(text: string) {
    setCodeValues((prev) => {
      const values = [...prev];
      if (text.length === 0) {
        values[index] = '';
        if (codeValues[index + 1] === '') {
          KeyboardController.setFocusTo('prev');
        }
        return values;
      }
      for (let i = 0; i < text.length; i++) {
        if (index + i >= NUM_OF_CODE_CHARACTERS) {
          break;
        }
        values[index + i] = text.charAt(i);
      }
      if (text.length < NUM_OF_CODE_CHARACTERS - 1) {
        KeyboardController.setFocusTo('next');
      } else {
        Keyboard.dismiss();
      }
      return values;
    });
  }

  return (
    <TextField
      value={value}
      editable={!isLoading}
      keyboardType="numeric"
      autoComplete="sms-otp"
      textContentType="oneTimeCode"
      containerClassName="flex-1 ios:bg-background ios:shadow-sm ios:shadow-muted/40
ios:border ios:border-border ios:rounded-lg "
      className="bg-card/80 ios:rounded-lg pr-2.5 text-center"
      clearButtonMode="never"
      materialHideActionIcons
      materialRingColor={hasError ? colors.destructive : undefined}
      onFocus={onFocus}
      onKeyPress={onKeyPress}
      onChangeText={onChangeText}
      onSubmitEditing={
        index === NUM_OF_CODE_CHARACTERS - 1
          ? onSubmit
          : () => KeyboardController.setFocusTo('next')
      }
      submitBehavior="submit"
      autoFocus={index === 0}
      selection={OTP_FIELD_SELECTION}
      accessibilityHint={hasError ? 'Missing OTP Character' : undefined}
    />
  );
}
