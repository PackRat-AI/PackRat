import { Button, Form, FormItem, FormSection, Text, TextField } from '@packrat/ui/nativewindui';
import { useUser } from 'app/features/auth/hooks/useUser';
import { useUpdateProfile } from 'app/features/profile/hooks/useUpdateProfile';
import { cn } from 'app/lib/cn';
import { useTranslation } from 'app/lib/hooks/useTranslation';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { Alert, Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NameScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const user = useUser();
  const { updateProfile, isLoading } = useUpdateProfile();

  const initialFirst = React.useRef(user?.firstName || '');
  const initialLast = React.useRef(user?.lastName || '');

  const [form, setForm] = React.useState({
    first: initialFirst.current,
    last: initialLast.current,
  });

  function onChangeText(type: 'first' | 'last') {
    return (text: string) => {
      setForm((prev) => ({ ...prev, [type]: text }));
    };
  }

  const trimmedFirst = React.useMemo(() => form.first.trim(), [form.first]);
  const trimmedLast = React.useMemo(() => form.last.trim(), [form.last]);

  const canSave =
    (trimmedFirst !== initialFirst.current.trim() || trimmedLast !== initialLast.current.trim()) &&
    !!trimmedFirst &&
    !!trimmedLast;

  async function handleSave() {
    if (!canSave || isLoading) return;
    const success = await updateProfile({
      firstName: trimmedFirst,
      lastName: trimmedLast,
    });
    if (success) {
      router.back();
    } else {
      Alert.alert(t('errors.somethingWentWrong'), t('errors.tryAgain'));
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('profile.nameScreenTitle'),
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect: 'systemMaterial',
          headerRight: Platform.select({
            ios: () => (
              <Button
                className="ios:px-0"
                disabled={!canSave || isLoading}
                variant="plain"
                onPress={handleSave}
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
          <FormSection materialIconProps={{ name: 'account-outline' }}>
            <FormItem>
              <TextField
                textContentType="givenName"
                autoFocus
                autoComplete="name-given"
                label={Platform.select({ ios: undefined, default: t('profile.firstNameLabel') })}
                leftView={Platform.select({
                  ios: <LeftLabel>{t('profile.firstNameLabel')}</LeftLabel>,
                })}
                placeholder={t('profile.requiredPlaceholder')}
                value={form.first}
                onChangeText={onChangeText('first')}
                submitBehavior="submit"
                enterKeyHint="next"
              />
            </FormItem>
            <FormItem>
              <TextField
                textContentType="familyName"
                autoComplete="name-family"
                label={Platform.select({ ios: undefined, default: t('profile.lastNameLabel') })}
                leftView={Platform.select({
                  ios: <LeftLabel>{t('profile.lastNameLabel')}</LeftLabel>,
                })}
                placeholder={t('profile.requiredPlaceholder')}
                value={form.last}
                onChangeText={onChangeText('last')}
                onSubmitEditing={handleSave}
                enterKeyHint="done"
              />
            </FormItem>
          </FormSection>
          {Platform.OS !== 'ios' && (
            <View className="items-end">
              <Button
                // className={cn('px-6', !canSave && 'bg-muted')}
                disabled={!canSave || isLoading}
                onPress={handleSave}
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

function LeftLabel({ children }: { children: string }) {
  return (
    <View className="w-28 justify-center pl-2">
      <Text className="font-medium">{children}</Text>
    </View>
  );
}
