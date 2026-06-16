import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Button, Sheet, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useSeasonSuggestionsPrefs } from 'expo-app/features/packs/atoms/seasonSuggestionsAtoms';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as React from 'react';
import { View } from 'react-native';

interface SeasonSuggestionsUnlockSheetProps {
  onExplore: () => void;
}

export const SeasonSuggestionsUnlockSheet = React.forwardRef<
  BottomSheetModal,
  SeasonSuggestionsUnlockSheetProps
>(function SeasonSuggestionsUnlockSheet({ onExplore }, ref) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { setAnnouncementSeen, setOpened } = useSeasonSuggestionsPrefs();

  const dismiss = () => {
    setAnnouncementSeen(true);
    if (ref && 'current' in ref) ref.current?.dismiss();
  };

  const handleExplore = () => {
    setAnnouncementSeen(true);
    setOpened(true);
    if (ref && 'current' in ref) ref.current?.dismiss();
    onExplore();
  };

  return (
    <Sheet
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
    >
      <BottomSheetView className="px-6 pb-10">
        <View className="mb-5 mt-2 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Icon
              name="leaf"
              namingScheme="sfSymbol"
              materialIcon={{ type: 'MaterialIcons', name: 'eco' }}
              size={32}
              color="white"
            />
          </View>
        </View>

        <Text variant="title2" className="mb-2 text-center font-bold">
          {t('seasons.unlockTitle')}
        </Text>

        <Text variant="subhead" className="mb-6 text-center text-muted-foreground">
          {t('seasons.unlockDescription')}
        </Text>

        <Button onPress={handleExplore} className="mb-3 w-full">
          <Text className="font-semibold text-white">{t('seasons.explore')}</Text>
        </Button>

        <Button variant="plain" onPress={dismiss} className="w-full items-center p-2">
          <Text variant="footnote" className="text-muted-foreground">
            {t('seasons.maybeLater')}
          </Text>
        </Button>
      </BottomSheetView>
    </Sheet>
  );
});
