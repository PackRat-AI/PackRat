import { useActionSheet } from '@expo/react-native-action-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Sheet, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { isAuthed } from 'expo-app/features/auth/store';
import { CatalogBrowserModal } from 'expo-app/features/catalog/components';
import type { CatalogItem, CatalogItemWithPackItemFields } from 'expo-app/features/catalog/types';
import { router } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useBulkAddCatalogItems, useImagePicker } from '../hooks';

interface AddPackItemActionsProps {
  packId: string;
}

export default React.forwardRef<BottomSheetModal, AddPackItemActionsProps>(
  function AddPackItemActions({ packId }, ref) {
    const [isCatalogModalVisible, setIsCatalogModalVisible] = React.useState(false);
    const { pickImage, takePhoto } = useImagePicker();
    const { showActionSheetWithOptions } = useActionSheet();
    const { colors } = useColorScheme();

    const { addItemsToPack } = useBulkAddCatalogItems();

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
        await addItemsToPack(packId as string, catalogItems as CatalogItemWithPackItemFields[]);
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
        >
          <BottomSheetView className="flex-1 px-4" style={{ flex: 1 }}>
            <View className="gap-2 mb-4">
              <TouchableOpacity
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
                <Text className="text-center font-medium">Add Manually</Text>
                <View className="ml-auto">
                  <Icon name="chevron-right" size={20} color={colors.grey2} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row gap-2 items-center rounded-lg border border-border bg-card p-4"
                onPress={handleAddFromPhoto}
              >
                <Icon name="camera-outline" size={20} color={colors.foreground} />
                <Text className="text-center font-medium">Scan Items from Photo</Text>
                <View className="ml-auto">
                  <Icon name="chevron-right" size={20} color={colors.grey2} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row gap-2 items-center rounded-lg border border-border bg-card p-4"
                onPress={handleAddFromCatalog}
              >
                <Icon name="cart-outline" size={20} color={colors.foreground} />
                <Text className="text-center font-medium">Add from Catalog</Text>
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
