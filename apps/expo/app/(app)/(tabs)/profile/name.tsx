import { Button, Form, FormItem, FormSection, Text, TextField } from '@packrat/ui/nativewindui';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardController } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NameScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [form, setForm] = React.useState({
    first: 'Zach',
    middle: 'Danger',
    last: 'Nugent',
  });

  function onChangeText(type: 'first' | 'middle' | 'last') {
    return (text: string) => {
      setForm((prev) => ({ ...prev, [type]: text }));
    };
  }

  function focusNext() {
    KeyboardController.setFocusTo('next');
  }

  const canSave =
    (form.first !== 'Zach' || form.middle !== 'Danger' || form.last !== 'Nugent') &&
    !!form.first &&
    !!form.last;

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
                disabled={!canSave}
                variant="plain"
                onPress={router.back}
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
          <FormSection materialIconProps={{ name: 'person-outline' }}>
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
                onSubmitEditing={focusNext}
                submitBehavior="submit"
                enterKeyHint="next"
              />
            </FormItem>
            <FormItem>
              <TextField
                textContentType="middleName"
                autoComplete="name-middle"
                label={Platform.select({ ios: undefined, default: t('profile.middleNameLabel') })}
                leftView={Platform.select({
                  ios: <LeftLabel>{t('profile.middleNameLabel')}</LeftLabel>,
                })}
                placeholder={t('profile.optionalPlaceholder')}
                value={form.middle}
                onChangeText={onChangeText('middle')}
                onSubmitEditing={focusNext}
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
                onSubmitEditing={router.back}
                enterKeyHint="done"
              />
            </FormItem>
          </FormSection>
          {Platform.OS !== 'ios' && (
            <View className="items-end">
              <Button
                className={cn('px-6', !canSave && 'bg-muted')}
                disabled={!canSave}
                onPress={router.back}
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
