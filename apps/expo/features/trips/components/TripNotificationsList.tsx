import { Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import type { NotificationPriority, NotificationType, TripNotification } from '../hooks';

interface TripNotificationsListProps {
  notifications: TripNotification[];
  isLoading: boolean;
  error: string | null;
}

const NOTIFICATION_ICON: Record<NotificationType, string> = {
  week_reminder: 'calendar-clock',
  three_day_reminder: 'package-variant',
  day_before: 'alarm',
  morning_of: 'flag-checkered',
  pack_progress: 'check-all',
  device_charging: 'battery-charging',
};

const PRIORITY_COLOR: Record<NotificationPriority, string> = {
  low: 'bg-blue-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

export function TripNotificationsList({
  notifications,
  isLoading,
  error,
}: TripNotificationsListProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-muted-foreground">
          {t('notifications.loadingReminders')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center py-6">
        <Icon name="alert-circle-outline" size={24} color={colors.destructive} />
        <Text className="mt-2 text-sm text-muted-foreground">{t('notifications.loadError')}</Text>
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View className="items-center py-6">
        <Icon name="bell-check-outline" size={28} color={colors.grey2} />
        <Text className="mt-2 text-sm text-muted-foreground">
          {t('notifications.noUpcomingReminders')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView scrollEnabled={false}>
      {notifications.map((notification) => (
        <Pressable
          key={`${notification.tripId}-${notification.type}`}
          onPress={() => router.push(`/trips/${notification.tripId}`)}
          className="mb-3 rounded-xl border border-border bg-card p-4"
        >
          <View className="flex-row items-start gap-3">
            {/* Icon badge */}
            <View
              className={`mt-0.5 h-9 w-9 items-center justify-center rounded-full ${PRIORITY_COLOR[notification.priority]}`}
            >
              <Icon
                name={
                  (NOTIFICATION_ICON[notification.type] as Parameters<typeof Icon>[0]['name']) ??
                  'bell-outline'
                }
                size={18}
                color="white"
              />
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold" numberOfLines={1}>
                  {notification.title}
                </Text>
                {notification.daysUntilTrip !== null && (
                  <Text className="text-xs text-muted-foreground">
                    {notification.daysUntilTrip === 0
                      ? t('notifications.today')
                      : notification.daysUntilTrip === 1
                        ? t('notifications.tomorrow')
                        : t('notifications.daysAway', { count: notification.daysUntilTrip })}
                  </Text>
                )}
              </View>
              <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={3}>
                {notification.message}
              </Text>
              <Text className="mt-1.5 text-xs font-medium text-primary">
                {notification.tripName}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
