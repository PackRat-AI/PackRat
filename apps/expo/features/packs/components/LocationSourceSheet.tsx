import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Sheet, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';

interface LocationSourceSheetProps {
  onSearchPress: () => void;
  onCurrentLocationPress: () => void;
  onDismiss?: () => void;
}

export const LocationSourceSheet = React.forwardRef<BottomSheetModal, LocationSourceSheetProps>(
  function LocationSourceSheet({ onSearchPress, onCurrentLocationPress, onDismiss }, ref) {
    const { colors } = useColorScheme();
    const { t } = useTranslation();

    return (
      <Sheet
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        onDismiss={onDismiss}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        <BottomSheetView className="px-6 pb-14 pt-4">
          <Text variant="title3" className="mb-2 text-center font-semibold">
            {t('seasons.chooseLocation')}
          </Text>
          <Text variant="subhead" className="mb-10 text-center text-muted-foreground">
            {t('seasons.chooseLocationDescription')}
          </Text>

          <View className="flex-row justify-center gap-10">
            <View className="items-center gap-4">
              <TouchableOpacity
                className="h-32 w-32 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.grey5 }}
                onPress={onSearchPress}
                activeOpacity={0.65}
              >
                <Icon
                  namingScheme="sfSymbol"
                  name="magnifyingglass"
                  materialIcon={{ type: 'MaterialIcons', name: 'search' }}
                  size={38}
                  color={colors.grey2}
                />
              </TouchableOpacity>
              <Text variant="body" className="text-center font-medium">
                {t('common.search')}
              </Text>
            </View>

            <View className="items-center gap-4">
              <TouchableOpacity
                className="h-32 w-32 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.grey5 }}
                onPress={onCurrentLocationPress}
                activeOpacity={0.65}
              >
                <Icon
                  namingScheme="sfSymbol"
                  name="location.fill"
                  materialIcon={{ type: 'MaterialIcons', name: 'my-location' }}
                  size={38}
                  color={colors.grey2}
                />
              </TouchableOpacity>
              <Text variant="body" className="max-w-28 text-center">
                {t('weather.useCurrentLocation')}
              </Text>
            </View>
          </View>
        </BottomSheetView>
      </Sheet>
    );
  },
);
