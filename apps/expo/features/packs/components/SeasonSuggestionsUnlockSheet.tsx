import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Sheet, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useSeasonSuggestionsPrefs } from 'expo-app/features/packs/atoms/seasonSuggestionsAtoms';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';

interface SeasonSuggestionsUnlockSheetProps {
  onExplore: () => void;
}

export const SeasonSuggestionsUnlockSheet = React.forwardRef<
  BottomSheetModal,
  SeasonSuggestionsUnlockSheetProps
>(function SeasonSuggestionsUnlockSheet({ onExplore }, ref) {
  const { colors } = useColorScheme();
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
      onDismiss={() => setAnnouncementSeen(true)}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
    >
      <BottomSheetView className="px-6 pb-10">
        {/* Icon header */}
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

        {/* Headline */}
        <Text variant="title2" className="mb-2 text-center font-bold">
          Season Suggestions Unlocked
        </Text>

        {/* Subtitle / description */}
        <Text variant="subhead" className="mb-6 text-center text-muted-foreground">
          You've built up a solid gear inventory. PackRat can now suggest what to pack based on the
          current season and your location — powered by AI.
        </Text>

        {/* CTA */}
        <TouchableOpacity
          className="mb-3 items-center rounded-xl bg-primary p-4"
          onPress={handleExplore}
          activeOpacity={0.8}
        >
          <Text className="font-semibold text-white">Explore</Text>
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity className="items-center p-2" onPress={dismiss} activeOpacity={0.7}>
          <Text variant="footnote" className="text-muted-foreground">
            Maybe later
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </Sheet>
  );
});
