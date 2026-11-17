import { use$ } from '@legendapp/state/react';
import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { format } from 'date-fns';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';
import { requestTripReminderPermission } from '../lib/tripReminderScheduler';
import { setTripRemindersMuted, tripReminderSettingsStore } from '../store/tripReminders';
import type { Trip } from '../types';
import { tripReminders } from '../utils/tripReminderPlanner';

/** Per-trip off switch for pre-trip reminders, with when the next one lands. */
export function TripRemindersRow({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const enabled = use$(tripReminderSettingsStore.enabled);
  const muted = use$(() => !!tripReminderSettingsStore.mutedTripIds.get()[trip.id]);

  const [next] = tripReminders({ trip, items: null, packedItemIds: new Set(), now: new Date() });
  // Nothing left to remind about: the trip has no date or has already started.
  if (!next) return null;

  const caption = !enabled
    ? t('trips.reminders.offInSettings')
    : muted
      ? null
      : t('trips.reminders.nextReminder', { when: format(next.fireDate, "EEEE, MMM d 'at' p") });

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
              if (on) requestTripReminderPermission();
            }}
            testID={testIds.trips.remindersToggle}
          />
        </View>
        {caption && (
          <Text variant="footnote" className="text-muted-foreground">
            {caption}
          </Text>
        )}
      </Card>
    </View>
  );
}
