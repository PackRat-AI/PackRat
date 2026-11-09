import { use$ } from '@legendapp/state/react';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';
import { requestVoicePermission } from '../lib/voiceIO';
import { voiceSettingsStore } from '../store/voiceSettings';

/** Settings › Voice: the user's switch for voice commands, and whether answers are spoken. */
export function VoiceSettingsSection() {
  const { t } = useTranslation();
  const flag = useFeatureFlag('enableVoiceCommands');
  const enabled = use$(voiceSettingsStore.enabled);
  const spokenAnswers = use$(voiceSettingsStore.spokenAnswers);
  if (!flag) return null;

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
      </View>
    </View>
  );
}
