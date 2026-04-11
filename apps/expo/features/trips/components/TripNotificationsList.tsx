import { Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type {
  ClientNotificationType,
  NotificationPriority,
  NotificationType,
  TripNotification,
} from '../hooks';
import { getTripNavigationParams } from '../utils/getTripNavigationParams';

interface TripNotificationsListProps {
  notifications: TripNotification[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

/**
 * Maps a structured `notificationType` from the API to the i18n key under
 * `notifications.messages.*`.  Returns `null` when no translation exists so
 * the caller can fall back to the English `message` string.
 */
const NOTIFICATION_TYPE_I18N_KEY: Record<ClientNotificationType, string | null> = {
  trip_today: 'notifications.messages.tripToday',
  trip_tomorrow: 'notifications.messages.tripTomorrow',
  trip_upcoming: 'notifications.messages.tripUpcoming',
  pack_incomplete: 'notifications.messages.packIncomplete',
  device_charging: 'notifications.messages.deviceCharging',
  week_reminder: 'notifications.messages.weekReminder',
};

const NOTIFICATION_ICON: Record<NotificationType, MaterialIconName> = {
  week_reminder: 'calendar-clock',
  three_day_reminder: 'backpack',
  day_before: 'alarm',
  morning_of: 'flag',
  pack_progress: 'check-circle',
  device_charging: 'lightning-bolt',
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
  onRetry,
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
        <Icon name="information-outline" size={24} color={colors.destructive} />
        <Text className="mt-2 text-sm text-muted-foreground">{t('notifications.loadError')}</Text>
        {onRetry && (
          <Pressable onPress={onRetry} className="mt-3">
            <Text className="text-sm font-medium text-primary">{t('common.retry')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View className="items-center py-6">
        <Icon name="bell-outline" size={28} color={colors.grey2} />
        <Text className="mt-2 text-sm text-muted-foreground">
          {t('notifications.noUpcomingReminders')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {notifications.map((notification) => {
        // Resolve i18n message: look up the structured type key and interpolate
        // variables.  Fall back to the English `message` string from the API.
        const i18nKey = NOTIFICATION_TYPE_I18N_KEY[notification.notificationType];
        const localizedMessage = i18nKey
          ? t(i18nKey, notification.variables as Record<string, unknown>)
          : notification.message;

        return (
          <Pressable
            key={`${notification.tripId}-${notification.type}`}
            onPress={() => router.push(getTripNavigationParams(notification.tripId))}
            className="mb-3 rounded-xl border border-border bg-card p-4"
          >
            <View className="flex-row items-start gap-3">
              {/* Icon badge */}
              <View
                className={`mt-0.5 h-9 w-9 items-center justify-center rounded-full ${PRIORITY_COLOR[notification.priority]}`}
              >
                <Icon name={NOTIFICATION_ICON[notification.type]} size={18} color="white" />
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
                  {localizedMessage}
                </Text>
                <Text className="mt-1.5 text-xs font-medium text-primary">
                  {notification.tripName}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
