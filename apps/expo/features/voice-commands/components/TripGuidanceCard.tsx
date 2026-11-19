import {
  AlertDialog,
  Column as JCColumn,
  RadioButton as JCRadioButton,
  Row as JCRow,
  Text as JCText,
  TextButton as JCTextButton,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  selectable,
  selectableGroup,
  testID as testIDModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { ThemedHost as JCHost } from '@packrat/ui/src/themed-host';
import type { MaterialIconName } from 'expo-app/components/Icon';
import { Icon } from 'expo-app/components/Icon';
import { useDistanceUnit } from 'expo-app/features/trip-stats/hooks/useDistanceUnit';
import { formatDistance, formatShortDistance } from 'expo-app/features/trip-stats/utils/units';
import type { Trip } from 'expo-app/features/trips/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  announce,
  type GuideSession,
  GuideStartError,
  guideStore,
  startGuidance,
  stopGuidance,
} from '../lib/tripGuide';
import {
  END_OF_ROUTE,
  type GuidanceDestination,
  isGuideOffRoute,
  maneuver,
  nextTurn,
  TRAILHEAD,
  waypointDestination,
} from '../utils/routeGuide';
import { compassName } from '../utils/routeProgress';
import { alreadyThere, navigatingAnswer } from '../utils/voiceAnswers';
import { useShowsTracking } from './TripTrackingSection';

/** Something to navigate to, on a trip that's underway, or guidance already running for it. */
export function useShowsGuidance(trip: Trip | undefined): boolean {
  const shows = useShowsTracking(trip);
  const guiding = use$(() => guideStore.session.get()?.tripId === trip?.id);
  if (!trip || !shows) return false;
  if (trip.status !== 'in_progress') return guiding;
  return (trip.plannedRoute?.length ?? 0) >= 2 || (trip.log?.waypoints?.length ?? 0) > 0;
}

/**
 * Guidance on the trip page: pick a place to be guided to, then the next turn, the distance left
 * and End, the way a maps app shows a route underway.
 */
export function TripGuidanceCard({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const alertRef = useRef<AlertMethods>(null);
  const current = use$(guideStore.session);
  const session = current?.tripId === trip.id ? current : null;
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const metric = useDistanceUnit() === 'metric';

  const route = trip.plannedRoute ?? [];
  const destinations: { key: string; label: string; destination: GuidanceDestination }[] = [];
  const first = route[0];
  const last = route[route.length - 1];
  if (route.length >= 2 && first && last) {
    destinations.push(
      {
        key: 'end',
        label: t('voiceCommands.guidance.endOfRoute'),
        destination: { name: END_OF_ROUTE, point: last },
      },
      {
        key: 'start',
        label: t('voiceCommands.guidance.trailhead'),
        destination: { name: TRAILHEAD, point: first },
      },
    );
  }
  // The newest few; older ones are a spoken "navigate to" away.
  for (const waypoint of [...(trip.log?.waypoints ?? [])].reverse().slice(0, 10)) {
    destinations.push({
      key: waypoint.id,
      label: waypoint.name,
      destination: waypointDestination(waypoint),
    });
  }

  const showProblem = (message: string) =>
    alertRef.current?.alert({
      title: t('voiceCommands.guidance.problemTitle'),
      message,
      materialIcon: { name: 'map-marker-alert-outline' },
      buttons: [{ text: t('common.ok'), style: 'cancel' }],
    });

  const navigate = async (destination: GuidanceDestination) => {
    setStarting(true);
    try {
      const { plan, position } = await startGuidance({
        tripId: trip.id,
        tripName: trip.name,
        destination,
        route,
      });
      void announce(navigatingAnswer({ plan, from: position, metric }));
    } catch (error) {
      const reason = error instanceof GuideStartError ? error.reason : 'noFix';
      if (reason === 'denied') showProblem(t('voiceCommands.guidance.locationOff'));
      else if (reason === 'alreadyThere') showProblem(alreadyThere(destination.name));
      else showProblem(t('voiceCommands.guidance.noFix'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <View className="mb-6" testID={testIds.voiceCommands.guidanceCard}>
      <Card className="gap-4 p-4">
        {session ? (
          <ActiveGuidance session={session} />
        ) : (
          <IdleGuidance
            busy={starting}
            disabled={Boolean(current)}
            onNavigate={() => setPicking(true)}
          />
        )}
      </Card>
      <DestinationDialog
        visible={picking}
        options={destinations}
        onPick={(destination) => {
          setPicking(false);
          void navigate(destination);
        }}
        onDismiss={() => setPicking(false)}
      />
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}

function IdleGuidance({
  busy,
  disabled,
  onNavigate,
}: {
  busy: boolean;
  disabled: boolean;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  return (
    <>
      <View className="flex-row items-center gap-3">
        <Icon name="sign-direction" size={24} color={colors.primary} />
        <View className="flex-1 gap-0.5">
          <Text variant="subhead" className="font-semibold">
            {t('voiceCommands.guidance.idleTitle')}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" wrap>
            {t('voiceCommands.guidance.idleDetail')}
          </Text>
        </View>
      </View>
      <Button
        variant="filled"
        className="gap-2"
        disabled={busy || disabled}
        onPress={onNavigate}
        testID={testIds.voiceCommands.guidanceNavigate}
      >
        {busy ? (
          <ActivityIndicator size={18} color={colors.primaryForeground} />
        ) : (
          <Icon name="navigation-variant" size={18} color={colors.primaryForeground} />
        )}
        <Text className="font-medium text-primary-foreground">
          {t('voiceCommands.guidance.navigate')}
        </Text>
      </Button>
    </>
  );
}

function ActiveGuidance({ session }: { session: GuideSession }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const { guide } = session;
  const name = guide.plan.destination.name;

  const short = (metres: number) =>
    unit === 'imperial' && metres < 0.2 * 1_609.344
      ? `${Math.max(50, Math.round((metres * 3.28084) / 50) * 50)} ft`
      : formatShortDistance({ metres, unit });

  let icon: MaterialIconName = 'arrow-up';
  let tint: string = colors.primary;
  let headline = t('voiceCommands.guidance.continue');
  let detail = t('voiceCommands.guidance.thenArrive', { name });
  const turn = nextTurn(guide);
  if (isGuideOffRoute(guide) && guide.progress) {
    icon = 'alert';
    tint = colors.destructive;
    headline = t('voiceCommands.guidance.offRoute');
    detail = t('voiceCommands.guidance.offRouteDetail', {
      direction: compassName(guide.progress.bearingToRoute),
      distance: short(guide.progress.offRouteMeters),
    });
  } else if (!guide.plan.path) {
    icon = 'navigation';
    const direction = compassName(session.bearing);
    headline = t('voiceCommands.guidance.head', {
      direction: direction.charAt(0).toUpperCase() + direction.slice(1),
    });
    detail = t('voiceCommands.guidance.straightTo', { name });
  } else if (turn && guide.progress) {
    const left = turn.degrees < 0;
    const size = Math.abs(turn.degrees);
    icon =
      size < 80
        ? left
          ? 'arrow-top-left'
          : 'arrow-top-right'
        : size < 135
          ? left
            ? 'arrow-left-top'
            : 'arrow-right-top'
          : left
            ? 'arrow-u-left-top'
            : 'arrow-u-right-top';
    headline = short(turn.alongMeters - guide.progress.alongMeters);
    const action = maneuver(turn);
    detail = t('voiceCommands.guidance.turnDetail', {
      maneuver: action.charAt(0).toUpperCase() + action.slice(1),
      direction: compassName(turn.headingAfter),
    });
  }

  return (
    <>
      <View className="flex-row items-center gap-4" testID={testIds.voiceCommands.guidanceNext}>
        <View
          className="h-14 w-14 items-center justify-center rounded-xl"
          style={{ backgroundColor: tint }}
        >
          <Icon name={icon} size={30} color={colors.primaryForeground} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="title2" className="font-bold" style={{ fontVariant: ['tabular-nums'] }}>
            {headline}
          </Text>
          <Text variant="subhead" className="text-muted-foreground" wrap>
            {detail}
          </Text>
        </View>
      </View>
      <View className="h-px bg-border" />
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5" testID={testIds.voiceCommands.guidanceRemaining}>
          <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
            {formatDistance({ metres: guide.remainingMeters, unit })}
          </Text>
          <Text variant="caption1" className="text-muted-foreground" numberOfLines={1}>
            {t('voiceCommands.guidance.toDestination', { name })}
          </Text>
        </View>
        <Button
          variant="filled"
          className="bg-destructive px-6"
          onPress={() => void stopGuidance()}
          testID={testIds.voiceCommands.guidanceEnd}
        >
          <Text className="font-medium text-destructive-foreground">
            {t('voiceCommands.guidance.end')}
          </Text>
        </Button>
      </View>
    </>
  );
}

/** An MD3 radio-list dialog: pick a place, then Navigate. */
function DestinationDialog({
  visible,
  options,
  onPick,
  onDismiss,
}: {
  visible: boolean;
  options: { key: string; label: string; destination: GuidanceDestination }[];
  onPick: (destination: GuidanceDestination) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  if (!visible) return null;

  const close = () => {
    setSelected(null);
    onDismiss();
  };

  return (
    <JCHost matchContents>
      <AlertDialog onDismissRequest={close}>
        <AlertDialog.Title>
          <JCText>{t('voiceCommands.guidance.pickTitle')}</JCText>
        </AlertDialog.Title>
        <AlertDialog.Text>
          <JCColumn modifiers={[selectableGroup()]}>
            {options.map((option) => (
              <JCRow
                key={option.key}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  height(48),
                  selectable(selected === option.key, () => setSelected(option.key), 'radioButton'),
                  testIDModifier(testIds.voiceCommands.guidanceOption(option.key)),
                ]}
              >
                <JCRadioButton selected={selected === option.key} />
                <JCText>{option.label}</JCText>
              </JCRow>
            ))}
          </JCColumn>
        </AlertDialog.Text>
        <AlertDialog.ConfirmButton>
          <JCTextButton
            enabled={selected !== null}
            onClick={() => {
              const picked = options.find((o) => o.key === selected);
              setSelected(null);
              if (picked) onPick(picked.destination);
            }}
          >
            <JCText>{t('voiceCommands.guidance.navigate')}</JCText>
          </JCTextButton>
        </AlertDialog.ConfirmButton>
        <AlertDialog.DismissButton>
          <JCTextButton onClick={close}>
            <JCText>{t('common.cancel')}</JCText>
          </JCTextButton>
        </AlertDialog.DismissButton>
      </AlertDialog>
    </JCHost>
  );
}
