import { useActionSheet } from '@expo/react-native-action-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Sheet, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { isAuthed } from 'expo-app/features/auth/store';
import { CatalogBrowserModal } from 'expo-app/features/catalog/components';
import { useRecentlyUsedCatalogItems } from 'expo-app/features/catalog/hooks/useRecentlyUsedCatalogItems';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TestIds } from 'expo-app/lib/testIds';
import { router } from 'expo-router';
import React from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBulkAddCatalogItems, useImagePicker } from '../hooks';

interface AddPackItemActionsProps {
  packId: string;
}

export default React.forwardRef<BottomSheetModal, AddPackItemActionsProps>(
  function AddPackItemActions({ packId }, ref) {
    const { t } = useTranslation();
    const [isCatalogModalVisible, setIsCatalogModalVisible] = React.useState(false);
    const { pickImage, takePhoto } = useImagePicker();
    const { showActionSheetWithOptions } = useActionSheet();
    const { colors } = useColorScheme();
    const insets = useSafeAreaInsets();

    const { addItemsToPack } = useBulkAddCatalogItems();
    const { trackRecentlyUsed } = useRecentlyUsedCatalogItems();

    const handleAddFromPhoto = () => {
      ref && typeof ref !== 'function' && ref.current?.close();

      if (!isAuthed.peek()) {
        return router.push({
          pathname: '/auth',
          params: {
            redirectTo: `/pack/${packId}`,
            showSignInCopy: 'true',
          },
        });
      }
      const options = ['Take Photo', 'Choose from Library', 'Cancel'];
      const cancelButtonIndex = 2;

      showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          containerStyle: {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom,
          },
          textStyle: {
            color: colors.foreground,
          },
        },
        async (selectedIndex) => {
          try {
            switch (selectedIndex) {
              case 0: {
                const fileInfo = await takePhoto();
                if (fileInfo)
                  router.push({
                    pathname: '/pack/items-scan',
                    params: { packId, ...fileInfo },
                  });
                break;
              }
              case 1: {
                const fileInfo = await pickImage();
                if (fileInfo)
                  router.push({
                    pathname: '/pack/items-scan',
                    params: { packId, ...fileInfo },
                  });
                break;
              }
              case cancelButtonIndex:
                return;
            }
          } catch (err) {
            console.error('Error handling image:', err);
          }
        },
      );
    };

    const handleAddFromCatalog = () => {
      ref && typeof ref !== 'function' && ref.current?.close();

      if (!isAuthed.peek()) {
        return router.push({
          pathname: '/auth',
          params: {
            redirectTo: `/pack/${packId}`,
            showSignInCopy: 'true',
          },
        });
      }
      setIsCatalogModalVisible(true);
    };

    const handleCatalogItemsSelected = async (catalogItems: CatalogItem[]) => {
      if (catalogItems.length > 0) {
        trackRecentlyUsed(catalogItems);
        try {
          await addItemsToPack(packId, catalogItems);
        } catch (error) {
          console.error('Error adding catalog items to pack:', error);
          Alert.alert(t('common.error'), t('catalog.somethingWentWrong'));
        }
      }
    };

    return (
      <>
        <Sheet
          ref={ref}
          enableDynamicSizing={true}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: colors.card }}
          handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
          bottomInset={insets.bottom}
        >
          <BottomSheetView className="flex-1 px-4" style={{ flex: 1 }}>
            <View className="gap-2 mb-4">
              <TouchableOpacity
                testID={TestIds.AddManuallyOption}
                className="flex-row gap-2 items-center rounded-lg border border-border bg-card p-4"
                onPress={() => {
                  ref && typeof ref !== 'function' && ref.current?.close();
                  router.push({
                    pathname: '/item/new',
                    params: { packId },
                  });
                }}
              >
                <Icon name="plus" size={20} color={colors.foreground} />
                <Text className="text-center font-medium">{t('packs.addManually')}</Text>
                <View className="ml-auto">
                  <Icon name="chevron-right" size={20} color={colors.grey2} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                testID={TestIds.ScanFromPhotoOption}
                className="flex-row gap-2 items-center rounded-lg border border-border bg-card p-4"
                onPress={handleAddFromPhoto}
              >
                <Icon name="camera-outline" size={20} color={colors.foreground} />
                <Text className="text-center font-medium">{t('packs.scanItemsFromPhoto')}</Text>
                <View className="ml-auto">
                  <Icon name="chevron-right" size={20} color={colors.grey2} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                testID={TestIds.AddFromCatalogOption}
                className="flex-row gap-2 items-center rounded-lg border border-border bg-card p-4"
                onPress={handleAddFromCatalog}
              >
                <Icon name="cart-outline" size={20} color={colors.foreground} />
                <Text className="text-center font-medium">{t('packs.addFromCatalog')}</Text>
                <View className="ml-auto">
                  <Icon name="chevron-right" size={20} color={colors.grey2} />
                </View>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        </Sheet>

        <CatalogBrowserModal
          visible={isCatalogModalVisible}
          onClose={() => setIsCatalogModalVisible(false)}
          onItemsSelected={handleCatalogItemsSelected}
        />
      </>
    );
  },
);
