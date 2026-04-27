import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'app/components/Icon';
import { featureFlags } from 'app/config';
import { useColorScheme } from 'app/lib/hooks/useColorScheme';
import { useTranslation } from 'app/lib/hooks/useTranslation';
import { useAtomValue } from 'jotai';
import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { aiModeAtom, localModelStatusAtom } from '../atoms/aiModeAtoms';
import { AIModeSheet } from './AIModeSheet';

export function AIModeSelector() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const mode = useAtomValue(aiModeAtom);
  const modelStatus = useAtomValue(localModelStatusAtom);
  const sheetRef = React.useRef<BottomSheetModal>(null);

  if (!featureFlags.enableLocalAI) return null;

  const isDownloading =
    modelStatus === 'downloading' || modelStatus === 'preparing' || modelStatus === 'checking';
  const label = mode === 'cloud' ? t('ai.cloud') : t('ai.local');

  return (
    <>
      <TouchableOpacity
        onPress={() => sheetRef.current?.present()}
        className="flex-row items-center gap-1"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="subhead" className="font-medium">
          {label}
        </Text>
        {isDownloading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 2 }} />
        ) : (
          <Icon name="chevron-down" size={14} color={colors.grey2} />
        )}
      </TouchableOpacity>

      <AIModeSheet ref={sheetRef} />
    </>
  );
}
