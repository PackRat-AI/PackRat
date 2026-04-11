import { Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Pressable, View } from 'react-native';
import type { VoiceCommand, VoiceListeningState } from '../types';

interface VoiceCommandPanelProps {
  listeningState: VoiceListeningState;
  lastTranscript: string;
  lastCommand: string | null;
  isTracking: boolean;
  waypointCount: number;
  availableCommands: VoiceCommand[];
  onStartListening: () => void;
  onStopListening: () => void;
  onTestCommand?: (transcript: string) => void;
}

const STATE_COLORS: Record<VoiceListeningState, string> = {
  idle: 'bg-muted',
  listening: 'bg-red-500',
  processing: 'bg-amber-500',
  error: 'bg-destructive',
};

const STATE_ICONS: Record<VoiceListeningState, MaterialIconName> = {
  idle: 'microphone-outline',
  listening: 'microphone',
  processing: 'dots-horizontal',
  error: 'information',
};

/**
 * Main voice command control panel.
 * Shows the microphone button, current status, last transcript,
 * and a reference list of available commands.
 */
export function VoiceCommandPanel({
  listeningState,
  lastTranscript,
  lastCommand,
  isTracking,
  waypointCount,
  availableCommands,
  onStartListening,
  onStopListening,
  onTestCommand,
}: VoiceCommandPanelProps) {
  const { t } = useTranslation();

  const isListening = listeningState === 'listening';
  const micBgClass = STATE_COLORS[listeningState];
  const micIcon = STATE_ICONS[listeningState];

  return (
    <View className="gap-6">
      {/* Status Row */}
      <View className="flex-row items-center gap-4 rounded-2xl bg-card p-4 border border-border">
        <View
          className={`h-3 w-3 rounded-full ${isTracking ? 'bg-green-500' : 'bg-muted-foreground'}`}
        />
        <Text className="text-sm text-foreground font-medium">
          {isTracking ? t('voice.trackingActive') : t('voice.trackingInactive')}
        </Text>
        <View className="ml-auto flex-row items-center gap-1">
          <Icon name="map-marker-outline" size={14} color="#6b7280" />
          <Text className="text-sm text-muted-foreground">
            {t('voice.waypointsCount', { count: waypointCount })}
          </Text>
        </View>
      </View>

      {/* Microphone Button */}
      <View className="items-center gap-3">
        <Pressable
          onPressIn={onStartListening}
          onPressOut={onStopListening}
          className={`h-24 w-24 items-center justify-center rounded-full ${micBgClass}`}
          accessibilityRole="button"
          accessibilityLabel={isListening ? t('voice.stopListening') : t('voice.startListening')}
          accessibilityState={{ selected: isListening }}
        >
          <Icon name={micIcon} size={40} color="white" />
        </Pressable>
        <Text className="text-base font-semibold text-foreground">
          {listeningState === 'idle' && t('voice.holdToSpeak')}
          {listeningState === 'listening' && t('voice.listening')}
          {listeningState === 'processing' && t('voice.processing')}
          {listeningState === 'error' && t('voice.error')}
        </Text>
        <Text className="text-xs text-muted-foreground text-center">
          {t('voice.holdMicDescription')}
        </Text>
      </View>

      {/* Last Transcript */}
      {lastTranscript ? (
        <View className="rounded-xl bg-card border border-border p-4 gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('voice.lastHeard')}
          </Text>
          <Text className="text-base text-foreground">"{lastTranscript}"</Text>
          {lastCommand && (
            <Text className="text-xs text-primary mt-1">
              ✓ {t('voice.executedCommand', { command: lastCommand.replace(/_/g, ' ') })}
            </Text>
          )}
        </View>
      ) : null}

      {/* Available Commands Reference */}
      <View className="gap-2">
        <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground px-1">
          {t('voice.availableCommands')}
        </Text>
        <View className="rounded-xl bg-card border border-border overflow-hidden">
          {availableCommands.map((cmd, index) => (
            <Pressable
              key={cmd.name}
              onPress={() => onTestCommand?.(cmd.patterns[0] ?? '')}
              className={`p-3 flex-row items-center gap-3 ${
                index < availableCommands.length - 1 ? 'border-b border-border' : ''
              }`}
              accessibilityRole="button"
              accessibilityLabel={`${t('voice.testCommand')} ${cmd.patterns[0]}`}
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
                <Icon name="microphone-outline" size={14} color="#7c3aed" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">"{cmd.patterns[0]}"</Text>
                <Text className="text-xs text-muted-foreground">{cmd.description}</Text>
              </View>
              <Icon name="chevron-right" size={14} color="#9ca3af" />
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-muted-foreground text-center px-4">
          {t('voice.tapCommandToTest')}
        </Text>
      </View>
    </View>
  );
}
