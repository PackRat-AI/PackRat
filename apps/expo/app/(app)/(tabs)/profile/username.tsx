import { Button, Form, FormItem, FormSection, Text, TextField } from '@packrat/ui/nativewindui';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UsernameScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [username, setUsername] = React.useState('mrzachnugent');

  const canSave = !!username && username !== 'mrzachnugent';
  return (
    <>
      <Stack.Screen
        options={{
          title: t('common.username'),
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect: 'systemMaterial',
          headerRight: Platform.select({
            ios: () => (
              <Button
                className="ios:px-0"
                disabled={!canSave}
                variant="plain"
                onPress={() => {
                  router.back();
                }}
              >
                <Text className={cn(canSave && 'text-primary')}>{t('common.save')}</Text>
              </Button>
            ),
          }),
        }}
      />

      <KeyboardAwareScrollView
        bottomOffset={8}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        <Form className="gap-5 px-4 pt-8">
          <FormSection
            materialIconProps={{ name: 'account-circle-outline' }}
            footnote={t('profile.usernameFootnote')}
          >
            <FormItem>
              <TextField
                textContentType="username"
                autoFocus
                autoComplete="username"
                className="pl-0.5"
                label={Platform.select({ ios: undefined, default: t('common.username') })}
                leftView={
                  <View className="ios:w-36 ios:justify-between flex-row items-center pl-2">
                    {Platform.OS === 'ios' && (
                      <Text className="font-medium">{t('common.username')}</Text>
                    )}
                    <Text className="text-muted-foreground">@</Text>
                  </View>
                }
                placeholder={t('profile.requiredPlaceholder')}
                value={username}
                onChangeText={setUsername}
              />
            </FormItem>
          </FormSection>
          {Platform.OS !== 'ios' && (
            <View className="items-end">
              <Button
                className={cn('px-6', !canSave && 'bg-muted')}
                disabled={!canSave}
                onPress={() => {
                  router.back();
                }}
              >
                <Text>{t('common.save')}</Text>
              </Button>
            </View>
          )}
        </Form>
      </KeyboardAwareScrollView>
    </>
  );
}
