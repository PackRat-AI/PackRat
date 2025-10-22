import { useActionSheet } from '@expo/react-native-action-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Button, Sheet, Text, useColorScheme, useSheetRef } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { isAuthed } from 'expo-app/features/auth/store';
import { CatalogBrowserModal } from 'expo-app/features/catalog/components';
import type { CatalogItem, CatalogItemWithPackItemFields } from 'expo-app/features/catalog/types';
import { useImagePicker } from 'expo-app/features/packs';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { AppTemplateBadge } from '../components/AppTemplateBadge';
import { PackTemplateItemCard } from '../components/PackTemplateItemCard';
import { useBulkAddCatalogItems, usePackTemplateDetails } from '../hooks';
import type { PackTemplateItem } from '../types';

export function PackTemplateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('all');
  const { colors } = useColorScheme();
  const bottomSheetRef = useSheetRef();
  const { pickImage, takePhoto } = useImagePicker();
  const { showActionSheetWithOptions } = useActionSheet();
  const [isCatalogModalVisible, setIsCatalogModalVisible] = useState(false);
  const { addItemsToPackTemplate } = useBulkAddCatalogItems();

  const packTemplate = usePackTemplateDetails(id as string);
  const user = useUser();

  const getTabStyle = (tab: string) => {
    return `flex-1 items-center py-4 ${activeTab === tab ? 'border-b-2 border-primary' : ''}`;
  };

  const getTabTextStyle = (tab: string) => {
    return activeTab === tab ? 'text-primary' : 'text-muted-foreground';
  };

  const filteredItems = (() => {
    if (!packTemplate?.items) return [];
    switch (activeTab) {
      case 'worn':
        return packTemplate.items.filter((item) => item.worn);
      case 'consumable':
        return packTemplate.items.filter((item) => item.consumable);
      default:
        return packTemplate.items;
    }
  })();

  const handleItemPress = useCallback(
    (item: PackTemplateItem) => {
      router.push({
        pathname: '/templateItem/[id]',
        params: {
          id: item.id,
          packTemplateId: packTemplate.id,
        },
      });
    },
    [router, packTemplate.id],
  );

  if (!packTemplate) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <NotFoundScreen title="Template not found" message="Please try again later." />
      </SafeAreaView>
    );
  }

  const handleCreate = () => {
    router.push({
      pathname: '/pack-templates/new',
      params: { templateId: packTemplate.id },
    });
  };

  const handleAddFromCatalog = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack-templates/${packTemplate.id}`,
          showSignInCopy: 'true',
        },
      });
    }
    setIsCatalogModalVisible(true);
    bottomSheetRef.current?.close();
  };

  const handleAddFromPhoto = () => {
    bottomSheetRef.current?.close();

    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack-templates/${packTemplate.id}`,
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
              // Take Photo
              const fileInfo = await takePhoto();
              if (fileInfo)
                router.push({
                  pathname: '/pack-templates/items-scan',
                  params: { packTemplateId: packTemplate.id, ...fileInfo },
                });
              break;
            }
            case 1: {
              // Choose from Library
              const fileInfo = await pickImage();
              if (fileInfo)
                router.push({
                  pathname: '/pack-templates/items-scan',
                  params: { packTemplateId: packTemplate.id, ...fileInfo },
                });
              break;
            }
            case cancelButtonIndex:
              // Canceled
              return;
          }
        } catch (err) {
          console.error('Error handling image:', err);
          appAlert.current?.alert({
            title: 'Error',
            message: 'Failed to process image. Please try again.',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        }
      },
    );
  };

  const handleCatalogItemsSelected = async (catalogItems: CatalogItem[]) => {
    await addItemsToPackTemplate(id as string, catalogItems as CatalogItemWithPackItemFields[]);
    Toast.show({
      type: 'success',
      text1: `Added ${catalogItems.length} ${catalogItems.length === 1 ? 'item' : 'items'}`,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView stickyHeaderIndices={[2]}>
        {packTemplate.image && (
          <Image source={{ uri: packTemplate.image }} className="h-48 w-full" resizeMode="cover" />
        )}

        {/* Header */}
        <View className="mb-4 p-4">
          <View className="mb-2">
            <Text className="text-2xl font-bold text-foreground">{packTemplate.name}</Text>
            {packTemplate.category && <Text variant="footnote">{packTemplate.category}</Text>}
          </View>

          {packTemplate.description && (
            <Text className="mb-4 text-muted-foreground">{packTemplate.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">BASE WEIGHT</Text>
              <WeightBadge weight={packTemplate.baseWeight || 0} unit="g" type="base" />
            </View>
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">TOTAL WEIGHT</Text>
              <WeightBadge weight={packTemplate.totalWeight || 0} unit="g" type="total" />
            </View>
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">ITEMS</Text>
              <Chip textClassName="text-center text-xs" variant="secondary">
                {packTemplate.items?.length || 0}
              </Chip>
            </View>
          </View>

          <View className="flex-row items-end justify-between">
            {packTemplate.tags && packTemplate.tags.length > 0 && (
              <View className="flex-row flex-wrap">
                {packTemplate.tags.map((tag) => (
                  <Chip
                    key={tag}
                    className="mr-2"
                    textClassName="text-xs text-center"
                    variant="outline"
                  >
                    #{tag}
                  </Chip>
                ))}
              </View>
            )}
            {packTemplate.isAppTemplate && <AppTemplateBadge />}
          </View>
        </View>

        {/* Actions */}
        <View className="p-4">
          <View className="gap-4 flex-row items-center">
            <Button className="flex-1" variant="secondary" onPress={handleCreate}>
              <Text>Use Template</Text>
            </Button>
            {(!packTemplate.isAppTemplate || user?.role === 'ADMIN') && (
              <Button
                className="flex-1"
                variant="secondary"
                onPress={() => bottomSheetRef.current?.present()}
              >
                <Text>Add Item</Text>
              </Button>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-background border-b border-border">
          <TouchableOpacity className={getTabStyle('all')} onPress={() => setActiveTab('all')}>
            <Text className={getTabTextStyle('all')}>All Items</Text>
          </TouchableOpacity>
          <TouchableOpacity className={getTabStyle('worn')} onPress={() => setActiveTab('worn')}>
            <Text className={getTabTextStyle('worn')}>Worn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={getTabStyle('consumable')}
            onPress={() => setActiveTab('consumable')}
          >
            <Text className={getTabTextStyle('consumable')}>Consumable</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <View>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <View key={item.id} className="px-4 pt-3">
                <PackTemplateItemCard
                  item={item}
                  belongsToAppTemplate={packTemplate.isAppTemplate}
                  onPress={handleItemPress}
                />
              </View>
            ))
          ) : (
            <View className="items-center justify-center p-4">
              <Text className="text-muted-foreground">No items found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Sheet
        ref={bottomSheetRef}
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
                bottomSheetRef.current?.close();
                router.push({
                  pathname: '/templateItem/new',
                  params: { packTemplateId: packTemplate.id },
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
    </SafeAreaView>
  );
}
