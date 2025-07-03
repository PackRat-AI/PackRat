import { useForm } from '@tanstack/react-form';
import { Button } from 'expo-app/components/nativewindui/Button';
import { Form, FormItem, FormSection } from 'expo-app/components/nativewindui/Form';
import { Text } from 'expo-app/components/nativewindui/Text';
import { TextField } from 'expo-app/components/nativewindui/TextField';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Alert, Image, Platform, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardController,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

const LOGO_SOURCE = require('expo-app/assets/packrat-app-icon-gradient.png');

// Define Zod schema for login validation
const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Type inference
type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [focusedTextField, setFocusedTextField] = React.useState<'email' | 'password' | null>(null);
  const { redirectTo } = useLocalSearchParams<{ redirectTo: string }>();

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onChange: loginFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        setIsLoading(true);
        await signIn(value.email, value.password);
        // Navigation is handled in function after successful login
      } catch (error) {
        setIsLoading(false);
        Alert.alert(
          'Login Failed',
          error instanceof Error ? error.message : 'Invalid email or password',
        );
      }
    },
  });

  // Combined loading state from form and auth context
  const loading = isLoading || authLoading;

  return (
    <View className="ios:bg-card flex-1" style={{ paddingBottom: insets.bottom }}>
      <Stack.Screen
        options={{
          title: 'Log in',
          headerShadowVisible: false,
          headerLeft() {
            return (
              <Link asChild href="/auth">
                <Button variant="plain" className="ios:px-0">
                  <Text className="text-primary">Cancel</Text>
                </Button>
              </Link>
            );
          },
        }}
      />
      <KeyboardAwareScrollView
        bottomOffset={Platform.select({ ios: 175 })}
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
              {Platform.select({ ios: 'Welcome back!', default: 'Log in' })}
            </Text>
            {Platform.OS !== 'ios' && (
              <Text className="ios:text-sm text-center text-muted-foreground">Welcome back!</Text>
            )}
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
                        onSubmitEditing={() => KeyboardController.setFocusTo('next')}
                        submitBehavior="submit"
                        autoFocus
                        onFocus={() => setFocusedTextField('email')}
                        onBlur={() => {
                          setFocusedTextField(null);
                          field.handleBlur();
                        }}
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
                <FormItem>
                  <form.Field name="password">
                    {(field) => (
                      <TextField
                        placeholder={Platform.select({
                          ios: 'Password',
                          default: '',
                        })}
                        label={Platform.select({
                          ios: undefined,
                          default: 'Password',
                        })}
                        onFocus={() => setFocusedTextField('password')}
                        onBlur={() => {
                          setFocusedTextField(null);
                          field.handleBlur();
                        }}
                        secureTextEntry
                        returnKeyType="done"
                        textContentType="password"
                        onSubmitEditing={() => form.handleSubmit()}
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        errorMessage={field.state.meta.errors[0]?.message}
                      />
                    )}
                  </form.Field>
                </FormItem>
              </FormSection>
              <View className="flex-row">
                <Link asChild href="/auth/(login)/forgot-password">
                  <Button size="sm" variant="plain" className="px-0.5">
                    <Text className="text-sm text-primary">Forgot password?</Text>
                  </Button>
                </Link>
              </View>
            </Form>
          </View>
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView
        offset={{
          closed: 0,
          opened: Platform.select({
            ios: insets.bottom + 30,
            default: insets.bottom,
          }),
        }}
      >
        {Platform.OS === 'ios' ? (
          <View className="px-12 py-4">
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  size="lg"
                  disabled={!canSubmit || loading}
                  onPress={() => form.handleSubmit()}
                >
                  <Text>{loading ? 'Logging in...' : 'Continue'}</Text>
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
              <Text className="px-0.5 text-sm text-primary">Create Account</Text>
            </Button>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  disabled={!canSubmit || loading}
                  onPress={() => {
                    if (focusedTextField === 'email') {
                      KeyboardController.setFocusTo('next');
                      return;
                    }
                    KeyboardController.dismiss();
                    form.handleSubmit();
                  }}
                >
                  <Text className="text-sm">
                    {loading ? 'Logging in...' : focusedTextField === 'email' ? 'Next' : 'Submit'}
                  </Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        )}
      </KeyboardStickyView>
      {Platform.OS === 'ios' && (
        <Button
          variant="plain"
          onPress={() => {
            router.replace({
              pathname: '/auth/(create-account)',
              params: { redirectTo },
            });
          }}
        >
          <Text className="text-sm text-primary">Create Account</Text>
        </Button>
      )}
    </View>
  );
}
