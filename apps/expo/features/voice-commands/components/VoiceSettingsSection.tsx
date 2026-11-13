import { use$ } from '@legendapp/state/react';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';
import { requestVoicePermission } from '../lib/voiceIO';
import { isWakeWordAvailable } from '../lib/wakeWord';
import { voiceSettingsStore } from '../store/voiceSettings';
import { turnOnWakeWord } from './TripVoiceBar';

/** Settings › Voice: the user's switch for voice commands, and whether answers are spoken. */
export function VoiceSettingsSection() {
  const { t } = useTranslation();
  const flag = useFeatureFlag('enableVoiceCommands');
  const enabled = use$(voiceSettingsStore.enabled);
  const spokenAnswers = use$(voiceSettingsStore.spokenAnswers);
  const wakeWord = use$(voiceSettingsStore.wakeWord);
  const settings = use$(voiceSettingsStore);
  if (!flag) return null;

  const guidanceSwitches = [
    {
      key: 'guidanceTurns',
      label: t('voiceCommands.settings.guidanceTurns'),
      testID: testIds.voiceCommands.guidanceTurnsToggle,
      on: settings.guidanceTurns !== false,
    },
    {
      key: 'guidanceMilestones',
      label: t('voiceCommands.settings.guidanceMilestones'),
      testID: testIds.voiceCommands.guidanceMilestonesToggle,
      on: settings.guidanceMilestones !== false,
    },
    {
      key: 'guidanceOffRoute',
      label: t('voiceCommands.settings.guidanceOffRoute'),
      testID: testIds.voiceCommands.guidanceOffRouteToggle,
      on: settings.guidanceOffRoute !== false,
    },
    {
      key: 'guidanceVibrateOnly',
      label: t('voiceCommands.settings.guidanceVibrateOnly'),
      testID: testIds.voiceCommands.guidanceVibrateToggle,
      on: settings.guidanceVibrateOnly === true,
    },
  ] as const;

  const setEnabled = (on: boolean) => {
    voiceSettingsStore.enabled.set(on);
    if (on) void requestVoicePermission();
  };

  return (
    <View>
      <Text variant="subhead" className="mb-3">
        {t('voiceCommands.settings.section')}
      </Text>
      <View className="rounded-xl border border-border bg-card">
        <View className="flex-row items-center justify-between gap-4 p-4">
          <View className="flex-1">
            <Text className="font-medium">{t('voiceCommands.settings.enabled')}</Text>
            <Text variant="footnote" className="mt-0.5 text-muted-foreground" wrap>
              {enabled
                ? t('voiceCommands.settings.enabledSubtitle')
                : t('voiceCommands.settings.enabledOffSubtitle')}
            </Text>
          </View>
          <Toggle
            value={enabled}
            onValueChange={setEnabled}
            testID={testIds.voiceCommands.settingsToggle}
          />
        </View>
        {enabled && (
          <View className="flex-row items-center justify-between gap-4 border-t border-border p-4">
            <View className="flex-1">
              <Text className="font-medium">{t('voiceCommands.settings.spokenAnswers')}</Text>
              <Text variant="footnote" className="mt-0.5 text-muted-foreground" wrap>
                {spokenAnswers
                  ? t('voiceCommands.settings.spokenAnswersSubtitle')
                  : t('voiceCommands.settings.spokenAnswersOffSubtitle')}
              </Text>
            </View>
            <Toggle
              value={spokenAnswers}
              onValueChange={(on) => voiceSettingsStore.spokenAnswers.set(on)}
              testID={testIds.voiceCommands.spokenAnswersToggle}
            />
          </View>
        )}
        {enabled && isWakeWordAvailable() && (
          <View className="flex-row items-center justify-between gap-4 border-t border-border p-4">
            <View className="flex-1">
              <Text className="font-medium">{t('voiceCommands.settings.wakeWord')}</Text>
              <Text variant="footnote" className="mt-0.5 text-muted-foreground" wrap>
                {wakeWord
                  ? t('voiceCommands.settings.wakeWordSubtitle')
                  : t('voiceCommands.settings.wakeWordOffSubtitle')}
              </Text>
            </View>
            <Toggle
              value={wakeWord}
              onValueChange={(on) =>
                on ? void turnOnWakeWord() : voiceSettingsStore.wakeWord.set(false)
              }
              testID={testIds.voiceCommands.wakeWordToggle}
            />
          </View>
        )}
      </View>
      {enabled && (
        <>
          <Text variant="subhead" className="mb-3 mt-6">
            {t('voiceCommands.settings.guidanceSection')}
          </Text>
          <View className="rounded-xl border border-border bg-card">
            {guidanceSwitches.map((item, index) => (
              <View
                key={item.key}
                className={`flex-row items-center justify-between gap-4 p-4 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <Text className="flex-1 font-medium">{item.label}</Text>
                <Toggle
                  value={item.on}
                  onValueChange={(on) => voiceSettingsStore[item.key].set(on)}
                  testID={item.testID}
                />
              </View>
            ))}
          </View>
          <Text variant="footnote" className="mt-2 px-1 text-muted-foreground" wrap>
            {settings.guidanceVibrateOnly
              ? t('voiceCommands.settings.guidanceVibrateFooter')
              : t('voiceCommands.settings.guidanceFooter')}
          </Text>
        </>
      )}
    </View>
  );
}
