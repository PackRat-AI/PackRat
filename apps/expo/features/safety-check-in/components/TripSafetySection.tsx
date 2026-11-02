import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Card } from '@packrat/ui/src/card';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { format } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import type { Trip } from 'expo-app/features/trips/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { capitalizeFirst, contactSummary } from '../lib/copy';
import { endSafetyCheckIn, refreshSafetyCheckIn } from '../lib/safetyActions';
import { setTripLifecycle } from '../lib/tripLifecycle';
import { safetyStore } from '../store/safetyCheckIn';
import type { LocalSafetyCheckIn } from '../types';
import {
  canStartTrip,
  contactsNotified,
  countdown,
  countdownText,
  isOverdue,
  overdueAt,
} from '../utils/safetyCheckIn';
import { pendingCount } from '../utils/safetyQueue';

/** Re-renders every 30 seconds, so a countdown stays current without a timer per digit. */
function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * The top of a trip from the day it starts: Start Trip, then, once the contacts have been told,
 * the check-in itself with its countdown, Check In, Running Late and the I'm Safe button.
 */
export function TripSafetySection({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const alertRef = useRef<AlertMethods>(null);
  const checkIn = use$(() => safetyStore.active.get()[trip.id]);
  const now = useNow();

  useEffect(() => {
    void refreshSafetyCheckIn({ tripId: trip.id, tripName: trip.name });
  }, [trip.id, trip.name]);

  const openSetup = () => router.push(`/trip/${trip.id}/safety-start`);

  const startTrip = () => {
    setTripLifecycle({ tripId: trip.id, status: 'in_progress' });
    alertRef.current?.alert({
      title: t('safetyCheckIn.start.askTitle'),
      message: t('safetyCheckIn.start.askMessage'),
      materialIcon: { name: 'shield-outline' },
      buttons: [
        { text: t('safetyCheckIn.start.withoutNotifying'), style: 'cancel' },
        { text: t('safetyCheckIn.start.notify'), style: 'default', onPress: openSetup },
      ],
    });
  };

  const status = trip.status ?? 'planned';
  let content: React.ReactNode = null;
  if (checkIn) {
    content = <SafetyCheckInCard trip={trip} checkIn={checkIn} now={now} onRetry={openSetup} />;
  } else if (status === 'in_progress') {
    content = (
      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="hiking" size={20} color={colors.primary} />
          <Text variant="subhead" className="flex-1 font-semibold text-primary">
            {t('safetyCheckIn.trail.title')}
          </Text>
          {trip.startedAt ? (
            <Text variant="footnote" className="text-muted-foreground">
              {t('safetyCheckIn.trail.since', { time: format(new Date(trip.startedAt), 'p') })}
            </Text>
          ) : null}
        </View>
        <Text variant="callout" className="text-muted-foreground" wrap>
          {t('safetyCheckIn.trail.noOneTold')}
        </Text>
        <View className="flex-row gap-2">
          <Button
            variant="filled"
            className="flex-1"
            onPress={openSetup}
            testID={testIds.safetyCheckIn.notifyContactsBtn}
          >
            <Text className="font-medium text-primary-foreground" numberOfLines={1}>
              {t('safetyCheckIn.start.notify')}
            </Text>
          </Button>
          <Button
            variant="outlined"
            className="flex-1"
            onPress={() => setTripLifecycle({ tripId: trip.id, status: 'complete' })}
            testID={testIds.safetyCheckIn.finishTripBtn}
          >
            <Text className="font-medium text-primary" numberOfLines={1}>
              {t('safetyCheckIn.trail.finish')}
            </Text>
          </Button>
        </View>
      </Card>
    );
  } else if (canStartTrip({ trip, now })) {
    content = (
      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="hiking" size={20} color={colors.primary} />
          <Text variant="subhead" className="font-semibold text-primary">
            {t('safetyCheckIn.start.ready')}
          </Text>
        </View>
        <Button
          variant="filled"
          size="lg"
          className="gap-2"
          onPress={startTrip}
          testID={testIds.safetyCheckIn.startTripBtn}
        >
          <Icon name="play" size={18} color="white" />
          <Text className="font-medium text-primary-foreground">
            {t('safetyCheckIn.start.startTrip')}
          </Text>
        </Button>
      </Card>
    );
  }

  return (
    <>
      {content ? <View className="mb-6">{content}</View> : null}
      <Alert title="" buttons={[]} ref={alertRef} />
    </>
  );
}

function SafetyCheckInCard({
  trip,
  checkIn,
  now,
  onRetry,
}: {
  trip: Trip;
  checkIn: LocalSafetyCheckIn;
  now: Date;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const alertRef = useRef<AlertMethods>(null);
  const pending = use$(() => pendingCount({ state: safetyStore.get(), tripId: trip.id }));

  const overdue = isOverdue({ checkIn, now });
  const tint = overdue ? colors.destructive : colors.primary;
  const count = checkIn.contactNames.length;
  const who = contactSummary({ names: checkIn.contactNames, t });
  const notified = contactsNotified(checkIn);

  const confirmSafe = () =>
    alertRef.current?.alert({
      title: t('safetyCheckIn.card.safeConfirmTitle'),
      message: t('safetyCheckIn.card.safeConfirmMessage', { who: capitalizeFirst(who) }),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('safetyCheckIn.card.imSafe'),
          style: 'default',
          onPress: () => {
            endSafetyCheckIn({ tripId: trip.id, outcome: 'safe' });
            setTripLifecycle({ tripId: trip.id, status: 'complete' });
          },
        },
      ],
    });

  const confirmCancel = () =>
    alertRef.current?.alert({
      title: t('safetyCheckIn.card.endConfirmTitle'),
      message: t('safetyCheckIn.card.endConfirmMessage', { who: capitalizeFirst(who) }),
      buttons: [
        { text: t('safetyCheckIn.card.keepCheckIn'), style: 'cancel' },
        {
          text: t('safetyCheckIn.card.endCheckIn'),
          style: 'destructive',
          onPress: () => endSafetyCheckIn({ tripId: trip.id, outcome: 'cancel' }),
        },
      ],
    });

  const footer = [
    notified || checkIn.startError
      ? null
      : t('safetyCheckIn.card.waitingForSignal', { who: capitalizeFirst(who), count }),
    checkIn.lastCheckInAt
      ? t('safetyCheckIn.card.lastCheckIn', { time: format(new Date(checkIn.lastCheckInAt), 'p') })
      : null,
    pending > 0 && notified ? t('safetyCheckIn.card.pendingUpdates', { count: pending }) : null,
    checkIn.trackingEnabled ? t('safetyCheckIn.card.sharingProgress') : null,
  ].filter((line): line is string => line !== null);

  const remaining = countdownText(countdown({ target: overdueAt(checkIn), now }));

  return (
    <Card className="gap-4 p-4" testID={testIds.safetyCheckIn.card}>
      <View className="flex-row items-center gap-2">
        <Icon name="shield-check-outline" size={20} color={tint} />
        <Text variant="subhead" className="flex-1 font-semibold" style={{ color: tint }}>
          {t('safetyCheckIn.card.title')}
        </Text>
        <DropdownMenu
          items={[
            ...(checkIn.shareUrl
              ? [
                  createDropdownItem({
                    actionKey: 'share',
                    title: t('safetyCheckIn.card.sharePage'),
                    icon: { name: 'share-variant-outline' },
                  }),
                ]
              : []),
            createDropdownItem({
              actionKey: 'end',
              title: t('safetyCheckIn.card.endCheckIn'),
              destructive: true,
              icon: { name: 'shield-off-outline' },
            }),
          ]}
          onItemPress={(item) => {
            if (item.actionKey === 'share' && checkIn.shareUrl) {
              void Share.share({ message: checkIn.shareUrl });
            } else if (item.actionKey === 'end') {
              confirmCancel();
            }
          }}
        >
          <View
            className="h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('safetyCheckIn.card.more')}
            testID={testIds.safetyCheckIn.menuBtn}
          >
            <Icon name="dots-vertical" size={22} color={colors.grey} />
          </View>
        </DropdownMenu>
      </View>

      {checkIn.startError ? (
        <View className="gap-1.5">
          <Text variant="heading" className="text-destructive">
            {t('safetyCheckIn.card.notNotifiedTitle')}
          </Text>
          <Text variant="callout" className="text-muted-foreground" wrap>
            {checkIn.startError}
          </Text>
          <Button
            variant="text"
            className="self-start px-0"
            onPress={() => {
              endSafetyCheckIn({ tripId: trip.id, outcome: 'cancel' });
              onRetry();
            }}
          >
            <Text className="font-medium text-primary">{t('safetyCheckIn.card.setUpAgain')}</Text>
          </Button>
        </View>
      ) : overdue ? (
        <View className="gap-1" testID={testIds.safetyCheckIn.overdue}>
          <Text variant="title2" className="font-bold text-destructive">
            {t('safetyCheckIn.card.overdueTitle')}
          </Text>
          <Text variant="callout" className="text-muted-foreground" wrap>
            {t('safetyCheckIn.card.overdueBody', { who: capitalizeFirst(who), count })}
          </Text>
        </View>
      ) : (
        <View className="gap-1">
          <Text
            variant="largeTitle"
            className="font-bold"
            style={{ fontVariant: ['tabular-nums'] }}
            testID={testIds.safetyCheckIn.countdown}
          >
            {remaining ?? t('safetyCheckIn.card.underMinute')}
          </Text>
          <Text variant="callout" className="text-muted-foreground" wrap>
            {t('safetyCheckIn.card.untilAlerted', {
              who,
              count,
              time: format(new Date(checkIn.expectedReturnAt), "EEE d MMM 'at' p"),
            })}
          </Text>
        </View>
      )}

      <View className="flex-row gap-2">
        <Button
          variant="outlined"
          className="flex-1"
          onPress={() => router.push(`/trip/${trip.id}/check-in`)}
          testID={testIds.safetyCheckIn.checkInBtn}
        >
          <Text className="font-medium text-primary" numberOfLines={1}>
            {t('safetyCheckIn.card.checkIn')}
          </Text>
        </Button>
        <Button
          variant="outlined"
          className="flex-1"
          onPress={() => router.push(`/trip/${trip.id}/running-late`)}
          testID={testIds.safetyCheckIn.runningLateBtn}
        >
          <Text className="font-medium text-primary" numberOfLines={1}>
            {t('safetyCheckIn.card.runningLate')}
          </Text>
        </Button>
      </View>

      <Button
        variant="filled"
        size="lg"
        className="gap-2 bg-destructive py-4"
        onPress={confirmSafe}
        testID={testIds.safetyCheckIn.imSafeBtn}
      >
        <Icon name="shield-check" size={22} color="white" />
        <Text className="text-lg font-bold text-white">{t('safetyCheckIn.card.imSafe')}</Text>
      </Button>

      {footer.length > 0 ? (
        <View className="gap-1">
          {footer.map((line) => (
            <Text key={line} variant="footnote" className="text-muted-foreground" wrap>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      <Alert title="" buttons={[]} ref={alertRef} />
    </Card>
  );
}
