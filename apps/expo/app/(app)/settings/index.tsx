import { ActivityIndicator, Text } from '@packrat/ui/nativewindui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Burnt from 'burnt';
import { appAlert } from 'expo-app/app/_layout';
import { Icon, type MaterialIconName } from 'expo-app/components/Icon';
import {
  localModelFileAvailableAtom,
  localModelProgressAtom,
  localModelStatusAtom,
} from 'expo-app/features/ai/atoms/aiModeAtoms';
import { LLAMA_MODEL_SIZE } from 'expo-app/features/ai/lib/constants';
import {
  cancelLocalModelDownload,
  deleteLocalModel,
  downloadLocalModel,
  isAppleIntelligenceAvailable,
} from 'expo-app/features/ai/lib/localModelManager';
import { DeleteAccountButton } from 'expo-app/features/auth/components/DeleteAccountButton';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useSeasonSuggestionsPrefs } from 'expo-app/features/packs/atoms/seasonSuggestionsAtoms';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAtomValue } from 'jotai';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { colorScheme, colors } = useColorScheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const modelStatus = useAtomValue(localModelStatusAtom);
  const progress = useAtomValue(localModelProgressAtom);
  const isDownloaded = useAtomValue(localModelFileAvailableAtom);

  const router = useRouter();
  const { announcementSeen, setAnnouncementSeen, opened, setOpened } = useSeasonSuggestionsPrefs();
  const { unit: weightUnit, setWeightUnit } = useWeightUnit();
  const { unit: temperatureUnit, setTemperatureUnit } = useTemperatureUnit();

  const isApple = isAppleIntelligenceAvailable();
  const isDownloading = modelStatus === 'downloading';
  const isPreparing = modelStatus === 'preparing' || modelStatus === 'checking';
  const isReady = modelStatus === 'ready';
  const isError = modelStatus === 'error';

  const handleClearAppData = () => {
    appAlert.current?.alert({
      title: 'Clear App Data',
      message:
        'This will delete the image cache and all locally stored preferences. You will stay logged in.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([ImageCacheManager.clearCache(), AsyncStorage.clear()]);
            Burnt.toast({ title: 'App data cleared', preset: 'done' });
          },
        },
      ],
    });
  };

  const handleDelete = () => {
    appAlert.current?.alert({
      title: t('ai.deleteModel'),
      message: 'This will remove the model from your device. You can re-download it later.',
      buttons: [
        { text: t('ai.cancel'), style: 'cancel' },
        {
          text: t('ai.deleteModel'),
          style: 'destructive',
          onPress: async () => {
            await deleteLocalModel();
            Burnt.toast({ title: 'Model deleted', preset: 'done' });
          },
        },
      ],
    });
  };

  const statusLabel = () => {
    if (isApple) return isReady ? t('ai.modelReady') : t('ai.modelPreparing');
    if (isDownloading) return 'Downloading';
    if (isPreparing) return t('ai.modelPreparing');
    if (isReady) return t('ai.modelReady');
    if (isError) return t('ai.modelError');
    if (isDownloaded) return 'Downloaded';
    return 'Not downloaded';
  };

  const iconName: MaterialIconName = isApple ? 'apple' : 'atom';

  return (
    <ScrollView className="flex-1 px-4 py-6">
      <View className="gap-6">
        <StatusBar
          style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
        />

        <View>
          <Text variant="subhead" className="mb-3">
            Display Units
          </Text>
          <View className="rounded-xl border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="font-medium">Weight</Text>
                <Text variant="footnote" className="mt-0.5 text-muted-foreground">
                  Shown on pack totals and items
                </Text>
              </View>
              <View className="flex-row overflow-hidden rounded-lg border border-border">
                <TouchableOpacity
                  className={`px-4 py-2 ${weightUnit === 'kg' ? 'bg-primary' : 'bg-card'}`}
                  onPress={() => setWeightUnit('kg')}
                >
                  <Text
                    variant="footnote"
                    className={`font-medium ${weightUnit === 'kg' ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`px-4 py-2 ${weightUnit === 'lb' ? 'bg-primary' : 'bg-card'}`}
                  onPress={() => setWeightUnit('lb')}
                >
                  <Text
                    variant="footnote"
                    className={`font-medium ${weightUnit === 'lb' ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    lb
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View className="h-px bg-border mx-4" />
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1">
                <Text className="font-medium">Temperature</Text>
                <Text variant="footnote" className="mt-0.5 text-muted-foreground">
                  Shown in weather forecasts
                </Text>
              </View>
              <View className="flex-row overflow-hidden rounded-lg border border-border">
                <TouchableOpacity
                  className={`px-4 py-2 ${temperatureUnit === 'C' ? 'bg-primary' : 'bg-card'}`}
                  onPress={() => setTemperatureUnit('C')}
                >
                  <Text
                    variant="footnote"
                    className={`font-medium ${temperatureUnit === 'C' ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    °C
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`px-4 py-2 ${temperatureUnit === 'F' ? 'bg-primary' : 'bg-card'}`}
                  onPress={() => setTemperatureUnit('F')}
                >
                  <Text
                    variant="footnote"
                    className={`font-medium ${temperatureUnit === 'F' ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    °F
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View>
          <Text variant="subhead" className="mb-3">
            {t('ai.modelManagement')}
          </Text>
          <View className="rounded-xl border border-border bg-card p-4">
            <View className="flex-row items-start gap-3">
              <View
                className="mt-0.5 h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: isApple ? '#a855f720' : '#6366f120' }}
              >
                <Icon name={iconName} size={22} color={isApple ? '#a855f7' : '#6366f1'} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold">
                  {isApple ? t('ai.appleFoundationModel') : t('ai.llamaModel')}
                </Text>
                <Text variant="footnote" className="mt-0.5 text-muted-foreground">
                  {isApple
                    ? 'Built into iOS 26+ · no download required'
                    : `qwen2.5-3b-instruct-q3_k_m.gguf · ${LLAMA_MODEL_SIZE}`}
                </Text>

                {/* Status + action row */}
                <View className="mt-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    {(isDownloading || isPreparing) && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                    <Text variant="footnote" color="tertiary">
                      {statusLabel()}
                    </Text>
                  </View>

                  {!isApple && (
                    <>
                      {isDownloading && (
                        <View className="flex-row items-center gap-3">
                          <Text variant="footnote" className="font-medium" color="tertiary">
                            {progress}%
                          </Text>
                          <TouchableOpacity onPress={cancelLocalModelDownload}>
                            <Text variant="footnote" className="font-medium text-destructive">
                              {t('ai.cancel')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {(!isDownloaded || isError) && !isDownloading && !isPreparing && (
                        <TouchableOpacity onPress={() => downloadLocalModel(isAuthenticated)}>
                          <Text
                            variant="footnote"
                            className="font-medium"
                            style={{ color: colors.primary }}
                          >
                            Download
                          </Text>
                        </TouchableOpacity>
                      )}
                      {isDownloaded && !isDownloading && !isPreparing && (
                        <TouchableOpacity onPress={handleDelete}>
                          <Text variant="footnote" className="font-medium text-destructive">
                            {t('ai.deleteModel')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        {isAuthenticated && (
          <View>
            <Text variant="subhead" className="mb-4">
              {t('profile.dangerZone')}
            </Text>
            <DeleteAccountButton />
          </View>
        )}

        {__DEV__ && (
          <View>
            <Text variant="subhead" className="mb-3">
              Developer
            </Text>
            <View className="rounded-xl border border-border bg-card">
              <TouchableOpacity
                className="flex-row items-center gap-3 p-4"
                onPress={handleClearAppData}
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                  <Icon name="delete-sweep" size={22} color="#f97316" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">Clear App Data</Text>
                  <Text variant="footnote" className="mt-0.5 text-muted-foreground">
                    Wipes image cache and stored preferences
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.grey} />
              </TouchableOpacity>
              <View className="h-px bg-border mx-4" />
              <TouchableOpacity
                className="flex-row items-center gap-3 p-4"
                onPress={() => {
                  setAnnouncementSeen(false);
                  setOpened(false);
                  router.dismissAll();
                  router.navigate('/');
                }}
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon name="leaf" size={22} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">Reset Season Suggestions State</Text>
                  <Text variant="footnote" className="mt-0.5 text-muted-foreground">
                    {`seen: ${announcementSeen} · opened: ${opened}`}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      {Constants.expoConfig && (
        <Text variant="footnote" className="self-center mt-8" color="tertiary">
          {Constants.expoConfig.name} v{Constants.expoConfig.version}
        </Text>
      )}
    </ScrollView>
  );
}
