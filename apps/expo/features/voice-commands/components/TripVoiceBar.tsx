import { use$ } from '@legendapp/state/react';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { canStartTrip } from 'expo-app/features/safety-check-in/utils/safetyCheckIn';
import type { Trip } from 'expo-app/features/trips/types';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { beginListening, dismissVoice, endListening, voiceStore } from '../lib/voiceController';
import { voiceSettingsStore } from '../store/voiceSettings';

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
  const { phase, heard, answer } = use$(voiceStore);
  // Waiting on a spoken yes or no listens too, so the button says so rather than inviting
  // another hold.
  const active = phase === 'listening' || phase === 'confirming';

  useEffect(() => dismissVoice, []);

  const press = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void beginListening(trip);
  };

  return (
    <View className="gap-2.5 px-4 pb-2 pt-2" testID={testIds.voiceCommands.bar}>
      {phase !== 'idle' && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          className="flex-row items-start gap-3 rounded-2xl border border-border bg-card p-3.5"
          testID={testIds.voiceCommands.banner}
        >
          <Icon
            name={active ? 'waveform' : phase === 'working' ? 'dots-horizontal' : 'message-text'}
            size={24}
            color={colors.primary}
          />
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
        onPressOut={endListening}
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
