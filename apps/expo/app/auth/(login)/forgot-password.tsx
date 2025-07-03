import { AlertAnchor } from '@packrat/ui/nativewindui/Alert';
import type { AlertRef } from '@packrat/ui/nativewindui/Alert/types';
import { Button } from '@packrat/ui/nativewindui/Button';
import { Form, FormItem, FormSection } from '@packrat/ui/nativewindui/Form';
import { Text } from '@packrat/ui/nativewindui/Text';
import { TextField } from '@packrat/ui/nativewindui/TextField';
import { useForm } from '@tanstack/react-form';
import { useAuthActions } from 'expo-app/features/auth/hooks/useAuthActions';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { Alert, Image, Platform, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

const LOGO_SOURCE = require('expo-app/assets/packrat-app-icon-gradient.png');

// Define Zod schema for email validation
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const alertRef = React.useRef<AlertRef>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { forgotPassword } = useAuthActions();

  const form = useForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onChange: emailSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        setIsLoading(true);

        await forgotPassword(value.email);

        // Navigate to verification code screen with email
        router.push({
          pathname: '/auth/one-time-password',
          params: { email: value.email, mode: 'reset-password' },
        });
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to send verification code',
        );
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <View className="ios:bg-card flex-1" style={{ paddingBottom: insets.bottom }}>
      <Stack.Screen
        options={{
          title: 'Forgot Password',
          headerShadowVisible: false,
        }}
      />
      <KeyboardAwareScrollView
        bottomOffset={Platform.select({ ios: 8 })}
        bounces={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="ios:pt-12 pt-20"
      >
        <View className="ios:px-12 flex-1 px-8">
          <View className="items-center pb-1">
            <Image
              source={LOGO_SOURCE}
              className="ios:h-12 ios:w-12 h-8 w-8 rounded-md"
              resizeMode="contain"
            />
            <Text variant="title1" className="ios:font-bold pb-1 pt-4 text-center">
              {Platform.select({
                ios: "What's your email?",
                default: 'Forgot password',
              })}
            </Text>
            {Platform.OS !== 'ios' && (
              <Text className="ios:text-sm text-center text-muted-foreground">
                What's your email?
              </Text>
            )}
            <Text className="px-4 pt-2 text-center text-muted-foreground">
              Enter your email address and we'll send you a verification code to reset your
              password.
            </Text>
          </View>
          <View className="ios:pt-4 pt-6">
            <Form className="gap-2">
              <FormSection className="ios:bg-background">
                <FormItem>
                  <form.Field name="email">
                    {(field) => (
                      <TextField
                        placeholder={Platform.select({
                          ios: 'Email',
                          default: '',
                        })}
                        label={Platform.select({
                          ios: undefined,
                          default: 'Email',
                        })}
                        onSubmitEditing={() => form.handleSubmit()}
                        submitBehavior="submit"
                        autoFocus
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        returnKeyType="next"
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        errorMessage={field.state.meta.errors[0]?.message}
                      />
                    )}
                  </form.Field>
                </FormItem>
              </FormSection>
            </Form>
          </View>
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        {Platform.OS === 'ios' ? (
          <View className="px-12 py-4">
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  size="lg"
                  onPress={() => form.handleSubmit()}
                  disabled={!canSubmit || isLoading}
                >
                  <Text>{isLoading ? 'Sending...' : 'Send Code'}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        ) : (
          <View className="flex-row justify-between py-4 pl-6 pr-8">
            <Button
              variant="plain"
              className="px-2"
              onPress={() => {
                router.replace('/auth/(create-account)');
              }}
            >
              <Text className="text-sm text-primary">Create Account</Text>
            </Button>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button onPress={() => form.handleSubmit()} disabled={!canSubmit || isLoading}>
                  <Text className="text-sm">{isLoading ? 'Sending...' : 'Send Code'}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        )}
      </KeyboardStickyView>
      <AlertAnchor ref={alertRef} />
    </View>
  );
}
