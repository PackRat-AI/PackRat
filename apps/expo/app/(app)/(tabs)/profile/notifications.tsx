import { Button, Form, FormItem, FormSection, Text, Toggle } from '@packrat/ui/nativewindui';
import { TripNotificationsList } from 'expo-app/features/trips/components/TripNotificationsList';
import { useTripNotifications } from 'expo-app/features/trips/hooks';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [notifications, setNotifications] = React.useState({
    push: true,
    email: false,
  });

  const { notifications: tripNotifications, isLoading, error, refresh } = useTripNotifications();

  function onValueChange(type: 'push' | 'email') {
    return (value: boolean) => {
      setNotifications((prev) => ({ ...prev, [type]: value }));
    };
  }

  const canSave = !notifications.push || notifications.email;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('profile.notifications'),
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

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        <Form className="gap-5 px-4 pt-8">
          <FormSection
            materialIconProps={{ name: 'bell-outline' }}
            footnote={t('profile.notificationsFootnote')}
          >
            <FormItem className="ios:px-4 ios:pb-2 ios:pt-2 flex-row justify-between px-2 pb-4">
              <View className="w-40 flex-row items-center justify-between">
                <Text className="font-medium">{t('profile.pushNotifications')}</Text>
              </View>
              <Toggle value={notifications.push} onValueChange={onValueChange('push')} />
            </FormItem>
            <FormItem className="ios:px-4 ios:pb-2 ios:pt-2 flex-row justify-between px-2 pb-4">
              <View className="w-40 flex-row items-center justify-between">
                <Text className="font-medium">{t('profile.emailNotifications')}</Text>
              </View>
              <Toggle value={notifications.email} onValueChange={onValueChange('email')} />
            </FormItem>
          </FormSection>

          {/* Trip Reminders Section */}
          <FormSection
            materialIconProps={{ name: 'map-clock-outline' }}
            ios={{ title: t('notifications.tripReminders') }}
            footnote={t('notifications.tripRemindersSubtitle')}
          >
            <View className="px-2 py-3">
              <TripNotificationsList
                notifications={tripNotifications}
                isLoading={isLoading}
                error={error}
                onRetry={refresh}
              />
            </View>
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
      </ScrollView>
    </>
  );
}
