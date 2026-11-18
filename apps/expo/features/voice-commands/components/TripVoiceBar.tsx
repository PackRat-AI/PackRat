import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { tripStartPromptOpen } from 'expo-app/features/safety-check-in/lib/tripLifecycle';
import { canStartTrip } from 'expo-app/features/safety-check-in/utils/safetyCheckIn';
import type { Trip } from 'expo-app/features/trips/types';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { askToShowNotification } from '../lib/trackRecorder';
import { beginListening, dismissVoice, endListening, handleWake } from '../lib/voiceController';
import { hasVoicePermission, requestVoicePermission, warmUpVoice } from '../lib/voiceIO';
import { followTrip, isWakeWordAvailable, leaveTrip } from '../lib/wakeWord';
import { voiceSettingsStore } from '../store/voiceSettings';
import { voiceStore } from '../store/voiceStore';

/** Shown while the trip is underway, and from its start day so "start my trip" works too. */
export function useShowsVoiceBar(trip: Trip | undefined): boolean {
  const flag = useFeatureFlag('enableVoiceCommands');
  const enabled = use$(voiceSettingsStore.enabled);
  if (!trip || !flag || !enabled) return false;
  const status = trip.status ?? 'planned';
  return status === 'in_progress' || canStartTrip({ trip, now: new Date() });
}

/**
 * Hold-to-talk at the bottom of a trip page, with a banner above it showing what PackRat heard
 * and what it answered.
 */
export function TripVoiceBar({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { phase, heard, status, answer } = use$(voiceStore);
  // Waiting on a spoken yes or no listens too, so the button says so rather than inviting
  // another hold.
  const active = phase === 'listening' || phase === 'confirming';

  useEffect(() => {
    warmUpVoice();
    return dismissVoice;
  }, []);

  const press = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    void beginListening(trip);
  };

  const release = () => {
    if (phase === 'listening') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    endListening();
  };

  return (
    <View className="gap-2.5 px-4 pb-2 pt-2" testID={testIds.voiceCommands.bar}>
      <WakeWordHost trip={trip} />
      {phase !== 'idle' && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          className="flex-row items-start gap-3 rounded-2xl border border-border bg-card p-3.5"
          testID={testIds.voiceCommands.banner}
        >
          {phase === 'working' ? (
            <ActivityIndicator size={24} color={colors.primary} />
          ) : (
            <Icon name={active ? 'waveform' : 'message-text'} size={24} color={colors.primary} />
          )}
          <View className="flex-1 gap-1">
            {heard ? (
              <Text variant="subhead" className="text-muted-foreground" wrap>
                “{heard}”
              </Text>
            ) : null}
            {answer ? (
              <Text variant="callout" className="font-medium" wrap>
                {answer}
              </Text>
            ) : phase === 'listening' && !heard ? (
              <Text variant="callout" className="font-medium">
                {t('voiceCommands.bar.listeningStatus')}
              </Text>
            ) : status ? (
              <Text variant="callout" className="font-medium text-muted-foreground">
                {status}
              </Text>
            ) : null}
            {phase === 'confirming' && (
              <Text variant="footnote" className="text-muted-foreground" wrap>
                {t('voiceCommands.bar.confirmHint')}
              </Text>
            )}
          </View>
          <Pressable
            onPress={dismissVoice}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('voiceCommands.bar.dismiss')}
            testID={testIds.voiceCommands.dismissBtn}
          >
            <Icon name="close" size={22} color={colors.grey} />
          </Pressable>
        </Animated.View>
      )}
      {/* An MD3 extended FAB: held rather than tapped, so it gets the larger 56dp target. */}
      <Pressable
        onPressIn={press}
        onPressOut={release}
        android_ripple={{ color: colors.grey4, borderless: false }}
        accessibilityRole="button"
        accessibilityLabel={t('voiceCommands.bar.buttonLabel')}
        accessibilityHint={t('voiceCommands.bar.buttonHint')}
        // TalkBack can't hold a press, so a double-tap starts and a second one stops.
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => (active ? endListening() : void beginListening(trip))}
        className="h-14 flex-row items-center justify-center gap-3 rounded-2xl"
        style={{ backgroundColor: active ? colors.destructive : colors.primary, elevation: 3 }}
        testID={testIds.voiceCommands.button}
      >
        <Icon
          name={active ? 'waveform' : 'microphone'}
          size={24}
          color={active ? colors.destructiveForeground : colors.primaryForeground}
        />
        <Text
          className={`text-base font-medium ${active ? 'text-destructive-foreground' : 'text-primary-foreground'}`}
        >
          {active ? t('voiceCommands.bar.listening') : t('voiceCommands.bar.holdToTalk')}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * "Hey PackRat" and the headset shortcut follow the trip: on while it's underway and the user has
 * turned them on, off once it ends. Leaving the trip page keeps them on. The first time a trip is
 * underway, the user is asked once whether to turn on "Hey PackRat".
 */
function WakeWordHost({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const alertRef = useRef<AlertMethods>(null);
  const wakeWord = use$(voiceSettingsStore.wakeWord);
  const offered = use$(voiceSettingsStore.wakeWordOffered);
  const phase = use$(voiceStore.phase);
  const otherPrompt = use$(tripStartPromptOpen);
  // A screen opened over the trip page, such as the check-in setup, hides the offer until the user
  // comes back.
  const focused = useIsFocused();
  const underway = (trip.status ?? 'planned') === 'in_progress';
  const latestTrip = useRef(trip);
  latestTrip.current = trip;

  useEffect(() => {
    if (!isWakeWordAvailable()) return;
    if (underway) followTrip(trip.id, () => void handleWake(latestTrip.current));
    else leaveTrip(trip.id);
  }, [trip.id, underway]);

  useEffect(() => {
    if (!isWakeWordAvailable() || !underway || wakeWord || offered || phase !== 'idle') return;
    if (otherPrompt || !focused) return;
    voiceSettingsStore.wakeWordOffered.set(true);
    alertRef.current?.alert({
      title: t('voiceCommands.wake.offerTitle'),
      message: t('voiceCommands.wake.offerMessage'),
      materialIcon: { name: 'microphone' },
      buttons: [
        { text: t('voiceCommands.wake.notNow'), style: 'cancel' },
        {
          text: t('voiceCommands.wake.turnOn'),
          style: 'default',
          onPress: () => void turnOnWakeWord(),
        },
      ],
    });
  }, [underway, wakeWord, offered, phase, otherPrompt, focused, t]);

  return <Alert title="" buttons={[]} ref={alertRef} />;
}

/** Whether hands-free commands already have the microphone and location they use. */
export async function hasHandsFreePermissions(): Promise<boolean> {
  const [microphone, location] = await Promise.all([
    hasVoicePermission(),
    Location.getForegroundPermissionsAsync(),
  ]);
  return microphone && location.granted;
}

/**
 * Asks, with the app on screen, for everything a hands-free command needs: the microphone to hear
 * it, location for answers like "mark waypoint" and the listening notification. A request made
 * once the phone is locked would wait unseen. False when the microphone is refused.
 */
async function askForHandsFree(): Promise<boolean> {
  if (!(await hasVoicePermission()) && !(await requestVoicePermission())) return false;
  try {
    const location = await Location.getForegroundPermissionsAsync();
    if (!location.granted && location.canAskAgain) {
      await Location.requestForegroundPermissionsAsync();
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'handsFreeLocationPermission' },
    });
  }
  await askToShowNotification();
  return true;
}

/** Asks for what hands-free commands need, then turns "Hey PackRat" on. */
export async function turnOnWakeWord(): Promise<void> {
  if (await askForHandsFree()) voiceSettingsStore.wakeWord.set(true);
}

/** Asks for what hands-free commands need, then turns the headset shortcut on. */
export async function turnOnHeadsetShortcut(): Promise<void> {
  if (await askForHandsFree()) voiceSettingsStore.headsetShortcut.set(true);
}
