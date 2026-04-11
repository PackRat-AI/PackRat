import { ListItem } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { featureFlags } from 'expo-app/config';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';

/**
 * Dashboard tile that navigates to the voice commands screen.
 */
export function VoiceCommandsTile() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  if (!featureFlags.enableVoiceCommands) return null;

  return (
    <View>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-violet-500">
              <Icon name="microphone" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <Icon name="chevron-right" size={17} color={colors.grey} />
          </View>
        }
        item={{
          title: t('voice.voiceCommands'),
          subTitle: t('voice.handsFreeNavigation'),
        }}
        onPress={() => router.push('/voice-commands')}
        target="Cell"
        index={0}
        removeSeparator={Platform.OS === 'ios'}
      />
    </View>
  );
}
