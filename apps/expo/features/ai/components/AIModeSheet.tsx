import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Sheet, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useAtom, useAtomValue } from 'jotai';
import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import type { AIMode } from '../atoms/aiModeAtoms';
import { aiModeAtom, localModelProgressAtom, localModelStatusAtom } from '../atoms/aiModeAtoms';
import { LLAMA_MODEL_SIZE } from '../lib/constants';
import { downloadLocalModel, isAppleModelSupported } from '../lib/localModelManager';
import { CircularDownloadButton } from './CircularDownloadButton';

type AIModeSheetProps = Record<string, never>;

export const AIModeSheet = React.forwardRef<BottomSheetModal, AIModeSheetProps>(
  function AIModeSheet(_props, ref) {
    const { colors } = useColorScheme();
    const { t } = useTranslation();
    const [mode, setMode] = useAtom(aiModeAtom);
    const modelStatus = useAtomValue(localModelStatusAtom);
    const progress = useAtomValue(localModelProgressAtom);

    const isApple = isAppleModelSupported();
    const isModelReady = modelStatus === 'ready';
    const isDownloading = modelStatus === 'downloading';
    const isPreparing = modelStatus === 'preparing' || modelStatus === 'checking';
    const isError = modelStatus === 'error';

    const handleSelectMode = (selected: AIMode) => {
      if (selected === 'local' && !isModelReady) {
        // trigger download/init but don't switch mode yet
        downloadLocalModel();
        return;
      }
      setMode(selected);
      if (ref && typeof ref !== 'function') ref.current?.close();
    };

    const handleDownload = () => {
      downloadLocalModel();
    };

    const localModelLabel = isApple
      ? t('ai.appleFoundationModel')
      : `${t('ai.llamaModel')} (${LLAMA_MODEL_SIZE})`;

    const localStatusNode = () => {
      if (isPreparing) {
        return (
          <View className="flex-row items-center gap-2">
            <Text variant="footnote" className="text-primary">
              {t('ai.modelPreparing')}...
            </Text>
          </View>
        );
      }
      if (isModelReady) {
        return (
          <View className="flex-row items-center gap-1">
            <Icon name="check-circle" size={14} color={colors.primary} />
            <Text variant="footnote" className="text-primary">
              {t('ai.modelReady')}
            </Text>
          </View>
        );
      }
      if (isError) {
        return (
          <Text variant="footnote" className="text-destructive">
            {t('ai.modelError')}
          </Text>
        );
      }
      // idle — show download button
      return null;
    };

    return (
      <Sheet
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        <BottomSheetView className="px-4 pb-8">
          <Text variant="title3" className="mb-4 mt-2 text-center font-semibold">
            {t('ai.inferenceMode')}
          </Text>

          {/* Cloud option */}
          <TouchableOpacity
            className="mb-3 flex-row items-center rounded-xl border border-border bg-card p-4"
            onPress={() => handleSelectMode('cloud')}
          >
            <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Icon name="cloud-outline" size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-medium">{t('ai.cloud')}</Text>
              <Text variant="footnote" className="text-muted-foreground">
                PackRat servers · requires internet
              </Text>
            </View>
            {mode === 'cloud' && <Icon name="check" size={20} color={colors.primary} />}
          </TouchableOpacity>

          {/* Local option */}
          <TouchableOpacity
            className="flex-row items-center rounded-xl border border-border bg-card p-4"
            onPress={() => handleSelectMode('local')}
            disabled={isDownloading || isPreparing}
          >
            <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
              <Icon name="cellphone" size={18} color="#a855f7" />
            </View>
            <View className="flex-1">
              <Text className="font-medium">{t('ai.local')}</Text>
              <Text variant="footnote" className="text-muted-foreground">
                {localModelLabel} · private & offline
              </Text>
              <View className="mt-1">{localStatusNode()}</View>
            </View>

            {/* Right side: checkmark or circular download/progress button */}
            {mode === 'local' && isModelReady ? (
              <Icon name="check" size={20} color={colors.primary} />
            ) : !isModelReady /** best is checking if ggml-org/SmolLM3-3B-GGUF/SmolLM3-Q4_K_M.gguf exists and downloaded fully? */ ||
              isDownloading ? (
              <CircularDownloadButton
                progress={progress}
                isDownloading={isDownloading}
                onDownload={handleDownload}
                size={36}
                strokeWidth={3}
              />
            ) : null}
          </TouchableOpacity>
        </BottomSheetView>
      </Sheet>
    );
  },
);
