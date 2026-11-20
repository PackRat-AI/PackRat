import { use$ } from '@legendapp/state/react';
import { isString } from '@packrat/guards';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Card } from '@packrat/ui/src/card';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { format } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { currentFix, LocatorError } from 'expo-app/features/safety-check-in/lib/locationTracking';
import { useDistanceUnit } from 'expo-app/features/trip-stats/hooks/useDistanceUnit';
import { formatDistance, formatElevation } from 'expo-app/features/trip-stats/utils/units';
import type { Trip } from 'expo-app/features/trips/types';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import {
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  TrackStartError,
  trackStore,
} from '../lib/trackRecorder';
import { addWaypoint, removeWaypoint, saveRecording } from '../lib/tripLogEdits';
import { waypointAt } from '../lib/waypointAt';
import { lastSample } from '../utils/recordedTrack';
import { clipUtf16, type TripWaypoint, WAYPOINT_LIMITS } from '../utils/tripWaypoints';

/** A recorder point this recent is where the user is, so marking while tracking is instant. */
const FRESH_SAMPLE_MS = 30_000;

/** Shown while the trip is underway, while it's being recorded, or once it has waypoints. */
export function useShowsTracking(trip: Trip | undefined): boolean {
  const flag = useFeatureFlag('enableVoiceCommands');
  const recording = use$(() => trackStore.track.get()?.tripId === trip?.id);
  if (!trip || !flag) return false;
  return trip.status === 'in_progress' || recording || (trip.log?.waypoints?.length ?? 0) > 0;
}

/**
 * Recording the hike and marking places along it, on the trip page while the trip is underway.
 * The same controls voice commands drive.
 */
export function TripTrackingSection({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const alertRef = useRef<AlertMethods>(null);
  const recording = use$(trackStore.track);
  const track = recording?.tripId === trip.id ? recording : null;
  const otherTrack = recording && recording.tripId !== trip.id ? recording : null;
  const waypoints = trip.log?.waypoints ?? [];
  const [isMarking, setIsMarking] = useState(false);

  const showLocationDenied = () =>
    alertRef.current?.alert({
      title: t('voiceCommands.tracking.locationOffTitle'),
      message: t('voiceCommands.tracking.locationOffMessage'),
      materialIcon: { name: 'map-marker-off-outline' },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('voiceCommands.tracking.openSettings'), onPress: () => Linking.openSettings() },
      ],
    });

  const start = async () => {
    try {
      await startRecording({ tripId: trip.id, tripName: trip.name });
    } catch (error) {
      if (error instanceof TrackStartError && error.reason === 'denied') showLocationDenied();
      else showStartFailed();
    }
  };

  const pauseOrResume = async () => {
    if (!track?.isPaused) return pauseRecording();
    try {
      await resumeRecording();
    } catch {
      showStartFailed();
    }
  };

  const showStartFailed = () =>
    alertRef.current?.alert({
      title: t('voiceCommands.tracking.startFailedTitle'),
      message: t('voiceCommands.tracking.startFailedMessage'),
      materialIcon: { name: 'map-marker-alert-outline' },
      buttons: [{ text: t('common.ok'), style: 'cancel' }],
    });

  const confirmStop = () =>
    alertRef.current?.alert({
      title: t('voiceCommands.tracking.stopTitle'),
      message: t('voiceCommands.tracking.stopMessage'),
      materialIcon: { name: 'stop-circle-outline' },
      buttons: [
        { text: t('voiceCommands.tracking.keepTracking'), style: 'cancel' },
        {
          text: t('voiceCommands.tracking.stopAndSave'),
          onPress: async () => {
            const finished = await stopRecording();
            if (finished) saveRecording(finished);
          },
        },
      ],
    });

  /** The spot is fixed on tap, so typing a name afterwards doesn't move it. */
  const markWaypoint = async () => {
    setIsMarking(true);
    let marked: TripWaypoint;
    try {
      const sample = track ? lastSample(track) : null;
      if (sample && Date.now() - sample.time < FRESH_SAMPLE_MS) {
        marked = waypointAt({ fix: sample });
      } else {
        marked = waypointAt({ fix: await currentFix({ acceptRecentMs: FRESH_SAMPLE_MS }) });
      }
    } catch (error) {
      if (error instanceof LocatorError && error.reason === 'denied') showLocationDenied();
      else
        alertRef.current?.alert({
          title: t('voiceCommands.tracking.noFixTitle'),
          message: t('voiceCommands.tracking.noFixMessage'),
          materialIcon: { name: 'crosshairs-question' },
          buttons: [{ text: t('common.ok'), style: 'cancel' }],
        });
      return;
    } finally {
      setIsMarking(false);
    }
    alertRef.current?.prompt({
      title: t('voiceCommands.tracking.nameTitle'),
      materialIcon: { name: 'map-marker-plus-outline' },
      prompt: { type: 'plain-text', defaultValue: marked.name, keyboardType: 'default' },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: (text) => {
            const name = isString(text) ? text.trim() : '';
            const waypoint = name
              ? { ...marked, name: clipUtf16({ text: name, limit: WAYPOINT_LIMITS.nameLength }) }
              : marked;
            if (!addWaypoint({ tripId: trip.id, waypoint })) {
              alertRef.current?.alert({
                title: t('voiceCommands.tracking.limitTitle'),
                message: t('voiceCommands.tracking.limitMessage'),
                buttons: [{ text: t('common.ok'), style: 'cancel' }],
              });
            }
          },
        },
      ],
    });
  };

  return (
    <View className="mb-6 gap-4" testID={testIds.voiceCommands.trackingSection}>
      {(trip.status === 'in_progress' || track) && (
        <TrackCard
          track={track}
          otherTripName={otherTrack?.tripName ?? null}
          isMarking={isMarking}
          onStart={() => void start()}
          onPauseOrResume={() => void pauseOrResume()}
          onStop={confirmStop}
          onMark={() => void markWaypoint()}
        />
      )}
      {waypoints.length > 0 && <WaypointList tripId={trip.id} waypoints={waypoints} />}
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}

function TrackCard({
  track,
  otherTripName,
  isMarking,
  onStart,
  onPauseOrResume,
  onStop,
  onMark,
}: {
  track: ReturnType<typeof trackStore.track.peek>;
  otherTripName: string | null;
  isMarking: boolean;
  onStart: () => void;
  onPauseOrResume: () => void;
  onStop: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();

  const title = !track
    ? t('voiceCommands.tracking.idleTitle')
    : track.isPaused
      ? t('voiceCommands.tracking.pausedTitle')
      : t('voiceCommands.tracking.recordingTitle');
  const detail = otherTripName
    ? t('voiceCommands.tracking.otherTrip', { name: otherTripName })
    : !track
      ? t('voiceCommands.tracking.idleDetail')
      : track.isPaused
        ? t('voiceCommands.tracking.pausedDetail')
        : t('voiceCommands.tracking.recordingDetail');
  const icon = !track ? 'map-marker-path' : track.isPaused ? 'pause-circle' : 'record-circle';
  const iconColor = !track ? colors.primary : track.isPaused ? colors.grey : colors.destructive;

  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center gap-3">
        <Icon name={icon} size={24} color={iconColor} />
        <View className="flex-1 gap-0.5">
          <Text variant="subhead" className="font-semibold">
            {title}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" wrap>
            {detail}
          </Text>
        </View>
      </View>

      {track && (
        <View className="flex-row" testID={testIds.voiceCommands.trackTotals}>
          <Figure
            value={formatDistance({ metres: track.distanceMeters, unit })}
            label={t('voiceCommands.tracking.distance')}
          />
          <Figure
            value={formatElevation({ metres: track.elevationGainMeters, unit })}
            label={t('voiceCommands.tracking.climbing')}
          />
          <Figure
            value={movingClock(track.movingSeconds)}
            label={t('voiceCommands.tracking.moving')}
          />
        </View>
      )}

      <View className="gap-2">
        {track ? (
          <View className="flex-row gap-2">
            <Button
              variant="outlined"
              className="flex-1 gap-2"
              onPress={onPauseOrResume}
              testID={
                track.isPaused
                  ? testIds.voiceCommands.trackResume
                  : testIds.voiceCommands.trackPause
              }
            >
              <Icon name={track.isPaused ? 'play' : 'pause'} size={18} color={colors.primary} />
              <Text className="font-medium text-primary">
                {track.isPaused
                  ? t('voiceCommands.tracking.resume')
                  : t('voiceCommands.tracking.pause')}
              </Text>
            </Button>
            <Button
              variant="outlined"
              className="flex-1 gap-2"
              onPress={onStop}
              testID={testIds.voiceCommands.trackStop}
            >
              <Icon name="stop" size={18} color={colors.destructive} />
              <Text className="font-medium text-destructive">
                {t('voiceCommands.tracking.stop')}
              </Text>
            </Button>
          </View>
        ) : (
          <Button
            variant="filled"
            className="gap-2"
            disabled={Boolean(otherTripName)}
            onPress={onStart}
            testID={testIds.voiceCommands.trackStart}
          >
            <Icon name="record-circle-outline" size={18} color={colors.primaryForeground} />
            <Text className="font-medium text-primary-foreground">
              {t('voiceCommands.tracking.start')}
            </Text>
          </Button>
        )}
        <Button
          variant="outlined"
          className="gap-2"
          disabled={isMarking}
          onPress={onMark}
          testID={testIds.voiceCommands.markWaypoint}
        >
          {isMarking ? (
            <ActivityIndicator size={18} color={colors.primary} />
          ) : (
            <Icon name="map-marker-plus-outline" size={18} color={colors.primary} />
          )}
          <Text className="font-medium text-primary">{t('voiceCommands.tracking.mark')}</Text>
        </Button>
      </View>
    </Card>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text variant="title3" className="font-bold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="caption1" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

/** "4:10" hours and minutes, like a watch. */
function movingClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function WaypointList({ tripId, waypoints }: { tripId: string; waypoints: TripWaypoint[] }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();

  return (
    <View className="gap-2" testID={testIds.voiceCommands.waypointList}>
      <Text variant="subhead" className="font-semibold text-muted-foreground">
        {t('voiceCommands.tracking.waypoints')}
      </Text>
      <Card>
        {[...waypoints].reverse().map((waypoint, index) => {
          const detail = [
            format(new Date(waypoint.createdAt), 'p'),
            waypoint.elevationMeters != null
              ? formatElevation({ metres: waypoint.elevationMeters, unit })
              : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <View
              key={waypoint.id}
              className={`flex-row items-start gap-3 py-3 pl-4 pr-1 ${index > 0 ? 'border-t border-border' : ''}`}
            >
              <View className="pt-0.5">
                <Icon
                  name={waypoint.note ? 'note-text-outline' : 'map-marker'}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="body" className="font-medium" wrap>
                  {waypoint.name}
                </Text>
                {waypoint.note ? (
                  <Text variant="subhead" wrap>
                    {waypoint.note}
                  </Text>
                ) : null}
                <Text variant="footnote" className="text-muted-foreground">
                  {detail}
                </Text>
              </View>
              <DropdownMenu
                items={[
                  createDropdownItem({
                    actionKey: 'delete',
                    title: t('voiceCommands.tracking.deleteWaypoint'),
                    destructive: true,
                    icon: { name: 'delete-outline' },
                  }),
                ]}
                onItemPress={() => removeWaypoint({ tripId, id: waypoint.id })}
              >
                <View
                  className="h-10 w-10 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={t('voiceCommands.tracking.waypointMore', {
                    name: waypoint.name,
                  })}
                >
                  <Icon name="dots-vertical" size={22} color={colors.grey} />
                </View>
              </DropdownMenu>
            </View>
          );
        })}
      </Card>
    </View>
  );
}
