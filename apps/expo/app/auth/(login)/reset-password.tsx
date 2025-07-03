import { AlertAnchor } from '@packrat/ui/nativewindui/Alert';
import type { AlertRef } from '@packrat/ui/nativewindui/Alert/types';
import { Button } from '@packrat/ui/nativewindui/Button';
import { Checkbox } from '@packrat/ui/nativewindui/Checkbox';
import { Form, FormItem, FormSection } from '@packrat/ui/nativewindui/Form';
import { Text } from '@packrat/ui/nativewindui/Text';
import { TextField } from '@packrat/ui/nativewindui/TextField';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { router, Stack, useLocalSearchParams } from 'expo-router';
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

// Enhanced password validation schema
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one number',
  })
  .refine((password) => /[^A-Za-z0-9]/.test(password), {
    message: 'Password must contain at least one special character',
  });

// Define Zod schema for password reset validation
const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Type inference
type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

// Password strength checker function
const getPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) {
    strength++;
  }
  if (/[A-Z]/.test(password)) {
    strength++;
  }
  if (/[a-z]/.test(password)) {
    strength++;
  }
  if (/[0-9]/.test(password)) {
    strength++;
  }
  if (/[^A-Za-z0-9]/.test(password)) {
    strength++;
  }

  let label = 'Very Weak';
  let color = 'bg-red-500';

  if (strength === 1) {
    label = 'Weak';
    color = 'bg-red-500';
  } else if (strength === 2) {
    label = 'Fair';
    color = 'bg-orange-500';
  } else if (strength === 3) {
    label = 'Good';
    color = 'bg-yellow-500';
  } else if (strength === 4) {
    label = 'Strong';
    color = 'bg-green-500';
  } else if (strength === 5) {
    label = 'Very Strong';
    color = 'bg-green-700';
  }

  return { strength, label, color };
};

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = React.useState(false);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [focusedTextField, setFocusedTextField] = React.useState<
    'password' | 'confirm-password' | null
  >(null);
  const alertRef = React.useRef<AlertRef>(null);

  // Get data from previous screen
  const params = useLocalSearchParams<{
    email: string;
    code: string;
  }>();

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    validators: {
      onChange: resetPasswordFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        setIsLoading(true);

        // Call the API to reset the password
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: params.email,
            code: params.code,
            newPassword: value.password,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to reset password');
        }

        // Show success message and navigate to login
        Alert.alert('Success', 'Your password has been reset successfully', [
          {
            text: 'Login',
            onPress: () => router.replace('/auth'),
          },
        ]);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reset password');
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <View className="ios:bg-card flex-1" style={{ paddingBottom: insets.bottom }}>
      <Stack.Screen
        options={{
          title: 'Reset Password',
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
              Create New Password
            </Text>
            <Text className="px-4 pt-2 text-center text-muted-foreground">
              Your new password must be different from previously used passwords.
            </Text>
          </View>
          <View className="ios:pt-4 pt-6">
            <Form className="gap-2">
              <FormSection className="ios:bg-background">
                <FormItem>
                  <form.Field name="password">
                    {(field) => {
                      const passwordStrength = getPasswordStrength(field.state.value);
                      return (
                        <View>
                          <TextField
                            placeholder={Platform.select({
                              ios: 'New Password',
                              default: '',
                            })}
                            label={Platform.select({
                              ios: undefined,
                              default: 'New Password',
                            })}
                            onSubmitEditing={() => KeyboardController.setFocusTo('next')}
                            onFocus={() => setFocusedTextField('password')}
                            onBlur={() => {
                              setFocusedTextField(null);
                              field.handleBlur();
                            }}
                            submitBehavior="submit"
                            secureTextEntry={!passwordVisible}
                            returnKeyType="next"
                            textContentType="newPassword"
                            value={field.state.value}
                            onChangeText={field.handleChange}
                            errorMessage={field.state.meta.errors[0]?.message}
                            autoFocus
                          />

                          {field.state.value ? (
                            <View className="mt-2 px-1">
                              <View className="mb-1 flex-row justify-between">
                                <Text className="text-xs text-gray-500">Password strength:</Text>
                                <Text className="text-xs font-medium">
                                  {passwordStrength.label}
                                </Text>
                              </View>
                              <View className="h-1 overflow-hidden rounded-full bg-gray-200">
                                <View
                                  className={`h-full ${passwordStrength.color}`}
                                  style={{
                                    width: `${(passwordStrength.strength / 5) * 100}%`,
                                  }}
                                />
                              </View>

                              {/* Password requirements checklist */}
                              <View className="mt-2 space-y-1">
                                <View className="flex-row items-center">
                                  <Icon
                                    name={field.state.value.length >= 8 ? 'check-circle' : 'circle'}
                                    size={14}
                                    color={field.state.value.length >= 8 ? '#10B981' : '#9CA3AF'}
                                  />
                                  <Text className="ml-1 text-xs text-gray-500">
                                    At least 8 characters
                                  </Text>
                                </View>
                                <View className="flex-row items-center">
                                  <Icon
                                    name={
                                      /[A-Z]/.test(field.state.value) ? 'check-circle' : 'circle'
                                    }
                                    size={14}
                                    color={/[A-Z]/.test(field.state.value) ? '#10B981' : '#9CA3AF'}
                                  />
                                  <Text className="ml-1 text-xs text-gray-500">
                                    At least 1 uppercase letter
                                  </Text>
                                </View>
                                <View className="flex-row items-center">
                                  <Icon
                                    name={
                                      /[a-z]/.test(field.state.value) ? 'check-circle' : 'circle'
                                    }
                                    size={14}
                                    color={/[a-z]/.test(field.state.value) ? '#10B981' : '#9CA3AF'}
                                  />
                                  <Text className="ml-1 text-xs text-gray-500">
                                    At least 1 lowercase letter
                                  </Text>
                                </View>
                                <View className="flex-row items-center">
                                  <Icon
                                    name={
                                      /[0-9]/.test(field.state.value) ? 'check-circle' : 'circle'
                                    }
                                    size={14}
                                    color={/[0-9]/.test(field.state.value) ? '#10B981' : '#9CA3AF'}
                                  />
                                  <Text className="ml-1 text-xs text-gray-500">
                                    At least 1 number
                                  </Text>
                                </View>
                                <View className="flex-row items-center">
                                  <Icon
                                    name={
                                      /[^A-Za-z0-9]/.test(field.state.value)
                                        ? 'check-circle'
                                        : 'circle'
                                    }
                                    size={14}
                                    color={
                                      /[^A-Za-z0-9]/.test(field.state.value) ? '#10B981' : '#9CA3AF'
                                    }
                                  />
                                  <Text className="ml-1 text-xs text-gray-500">
                                    At least 1 special character
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    }}
                  </form.Field>
                </FormItem>
                <FormItem>
                  <form.Field name="confirmPassword">
                    {(field) => (
                      <TextField
                        placeholder={Platform.select({
                          ios: 'Confirm password',
                          default: '',
                        })}
                        label={Platform.select({
                          ios: undefined,
                          default: 'Confirm password',
                        })}
                        onFocus={() => setFocusedTextField('confirm-password')}
                        onBlur={() => {
                          setFocusedTextField(null);
                          field.handleBlur();
                        }}
                        onSubmitEditing={() => form.handleSubmit()}
                        secureTextEntry={!passwordVisible}
                        returnKeyType="done"
                        textContentType="newPassword"
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        errorMessage={field.state.meta.errors[0]?.message}
                      />
                    )}
                  </form.Field>
                </FormItem>

                {/* Password visibility checkbox */}
                <View className="mb-4 mt-2 flex-row items-center">
                  <Checkbox
                    checked={passwordVisible}
                    onCheckedChange={setPasswordVisible}
                    id="show-password"
                  />
                  <Text className="ml-2 text-sm text-gray-700">Show password</Text>
                </View>
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
                  disabled={!canSubmit || isLoading}
                  onPress={() => form.handleSubmit()}
                >
                  <Text>{isLoading ? 'Resetting...' : 'Reset Password'}</Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        ) : (
          <View className="flex-row justify-end py-4 pl-6 pr-8">
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  disabled={!canSubmit || isLoading}
                  onPress={() => {
                    if (focusedTextField !== 'confirm-password') {
                      KeyboardController.setFocusTo('next');
                      return;
                    }
                    KeyboardController.dismiss();
                    form.handleSubmit();
                  }}
                >
                  <Text className="text-sm">
                    {isLoading
                      ? 'Resetting...'
                      : focusedTextField !== 'confirm-password'
                        ? 'Next'
                        : 'Reset Password'}
                  </Text>
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
