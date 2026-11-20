import { use$ } from '@legendapp/state/react';
import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { format } from 'date-fns';
import { PermissionNotice } from 'expo-app/components/PermissionNotice';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useNotificationsGranted } from 'expo-app/lib/permissions/usePermissionGranted';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';
import { requestTripReminderPermission } from '../lib/tripReminderScheduler';
import { setTripRemindersMuted, tripReminderSettingsStore } from '../store/tripReminders';
import type { Trip } from '../types';
import { tripReminderCaption } from '../utils/tripReminderCaption';
import { tripReminders } from '../utils/tripReminderPlanner';

/** Per-trip off switch for pre-trip reminders, with when the next one lands. */
export function TripRemindersRow({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const enabled = use$(tripReminderSettingsStore.enabled);
  const muted = use$(() => !!tripReminderSettingsStore.mutedTripIds.get()[trip.id]);
  const notifications = useNotificationsGranted(enabled && !muted);

  const [next] = tripReminders({ trip, items: null, packedItemIds: new Set(), now: new Date() });
  // Nothing left to remind about: the trip has no date or has already started.
  if (!next) return null;

  const captionKind = tripReminderCaption({
    enabled,
    muted,
    notificationsGranted: notifications.granted,
  });
  const caption =
    captionKind === 'offInSettings'
      ? t('trips.reminders.offInSettings')
      : captionKind === 'notificationsOff'
        ? t('trips.reminders.notificationsOff')
        : captionKind === 'nextReminder'
          ? t('trips.reminders.nextReminder', {
              when: format(next.fireDate, "EEEE, MMM d 'at' p"),
            })
          : null;

  return (
    <View className="mb-6">
      <Card key={caption ?? 'muted'} className="gap-1 p-4">
        <View className="min-h-12 flex-row items-center gap-4">
          <Text variant="body" className="flex-1 font-semibold text-foreground">
            {t('trips.reminders.title')}
          </Text>
          <Toggle
            value={enabled && !muted}
            disabled={!enabled}
            onValueChange={(on) => {
              setTripRemindersMuted({ tripId: trip.id, muted: !on });
              if (on) void requestTripReminderPermission().then(notifications.refresh);
            }}
            testID={testIds.trips.remindersToggle}
          />
        </View>
        {caption && captionKind === 'notificationsOff' ? (
          <PermissionNotice
            message={caption}
            settings="notifications"
            testID={testIds.trips.remindersOpenSettingsBtn}
          />
        ) : caption ? (
          <Text variant="footnote" className="text-muted-foreground">
            {caption}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}
