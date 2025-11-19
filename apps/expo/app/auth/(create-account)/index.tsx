'use client';

import { Button, Form, FormItem, FormSection, Text, TextField } from '@packrat/ui/nativewindui';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router } from 'expo-router';
import * as React from 'react';
import { Image, Platform, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardController,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

const LOGO_SOURCE = require('expo-app/assets/packrat-app-icon-gradient.png');

// Define Zod schema for name validation
const nameFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

// Type inference
// type NameFormValues = z.infer<typeof nameFormSchema>;

export default function InfoScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [focusedTextField, setFocusedTextField] = React.useState<'first-name' | 'last-name' | null>(
    null,
  );

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
    },
    validators: {
      onChange: nameFormSchema,
    },
    onSubmit: async ({ value }) => {
      // Navigate to credentials screen with form data
      router.push({
        pathname: '/auth/(create-account)/credentials',
        params: {
          firstName: value.firstName,
          lastName: value.lastName,
        },
      });
    },
  });

  return (
    <View className="ios:bg-card flex-1" style={{ paddingBottom: insets.bottom }}>
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
                ios: t('auth.whatsYourName'),
                default: t('auth.createYourAccount'),
              })}
            </Text>
            {Platform.OS !== 'ios' && (
              <Text className="ios:text-sm text-center text-muted-foreground">
                {t('auth.welcomeBack')}
              </Text>
            )}
          </View>
          <View className="ios:pt-4 pt-6">
            <Form className="gap-2">
              <FormSection className="ios:bg-background">
                <FormItem>
                  <form.Field name="firstName">
                    {(field) => (
                      <TextField
                        placeholder={Platform.select({
                          ios: t('auth.firstName'),
                          default: '',
                        })}
                        label={Platform.select({
                          ios: undefined,
                          default: t('auth.firstName'),
                        })}
                        onSubmitEditing={() => KeyboardController.setFocusTo('next')}
                        submitBehavior="submit"
                        autoFocus
                        onFocus={() => setFocusedTextField('first-name')}
                        onBlur={() => {
                          setFocusedTextField(null);
                          field.handleBlur();
                        }}
                        textContentType="name"
                        returnKeyType="next"
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        errorMessage={field.state.meta.errors[0]?.message}
                      />
                    )}
                  </form.Field>
                </FormItem>
                <FormItem>
                  <form.Field name="lastName">
                    {(field) => (
                      <TextField
                        placeholder={Platform.select({
                          ios: t('auth.lastName'),
                          default: '',
                        })}
                        label={Platform.select({
                          ios: undefined,
                          default: t('auth.lastName'),
                        })}
                        onFocus={() => setFocusedTextField('last-name')}
                        onBlur={() => {
                          setFocusedTextField(null);
                          field.handleBlur();
                        }}
                        textContentType="givenName"
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => form.handleSubmit()}
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
                  disabled={!canSubmit || isSubmitting}
                  onPress={() => form.handleSubmit()}
                >
                  <Text>{isSubmitting ? t('auth.loading') : t('common.continue')}</Text>
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
                router.replace('/auth/(login)');
              }}
            >
              <Text className="text-sm text-primary">{t('auth.alreadyHaveAccount')}</Text>
            </Button>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  disabled={!canSubmit || isSubmitting}
                  onPress={() => {
                    if (focusedTextField === 'first-name') {
                      KeyboardController.setFocusTo('next');
                      return;
                    }
                    KeyboardController.dismiss();
                    form.handleSubmit();
                  }}
                >
                  <Text className="text-sm">
                    {isSubmitting ? t('auth.loading') : t('auth.next')}
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
            router.replace('/auth/(login)');
          }}
        >
          <Text className="text-sm text-primary">{t('auth.alreadyHaveAccount')}</Text>
        </Button>
      )}
    </View>
  );
}
