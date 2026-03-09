import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoiceCommandPanel } from '../components/VoiceCommandPanel';
import { useVoiceCommands } from '../hooks/useVoiceCommands';

export function VoiceCommandScreen() {
  const { t } = useTranslation();
  const {
    listeningState,
    lastCommand,
    lastTranscript,
    isTracking,
    waypoints,
    availableCommands,
    startListening,
    stopListening,
    processTranscript,
  } = useVoiceCommands();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">{t('voice.voiceCommands')}</Text>
          <Text className="mt-1 text-base text-muted-foreground">
            {t('voice.screenDescription')}
          </Text>
        </View>

        {/* Offline badge */}
        <View className="mb-6 flex-row items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
          <View className="h-2 w-2 rounded-full bg-green-500" />
          <Text className="text-sm font-medium text-green-700 dark:text-green-400">
            {t('voice.offlineCapable')}
          </Text>
          <Text className="text-xs text-muted-foreground">{t('voice.offlineDescription')}</Text>
        </View>

        <VoiceCommandPanel
          listeningState={listeningState}
          lastTranscript={lastTranscript}
          lastCommand={lastCommand}
          isTracking={isTracking}
          waypointCount={waypoints.length}
          availableCommands={availableCommands}
          onStartListening={startListening}
          onStopListening={stopListening}
          onTestCommand={processTranscript}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
