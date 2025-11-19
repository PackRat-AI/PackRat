import { Button, Text, useSheetRef } from '@packrat/ui/nativewindui';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import AddPackTemplateItemActions from '../components/AddPackTemplateItemActions';
import { AppTemplateBadge } from '../components/AppTemplateBadge';
import { PackTemplateItemCard } from '../components/PackTemplateItemCard';
import { usePackTemplateDetails } from '../hooks';
import type { PackTemplateItem } from '../types';

export function PackTemplateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('all');
  const addPackTemplateItemActionsRef = useSheetRef();

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
        <NotFoundScreen
          title={t('packTemplates.templateNotFound')}
          message={t('packTemplates.pleaseTryAgainLater')}
        />
      </SafeAreaView>
    );
  }

  const handleCreate = () => {
    router.push({
      pathname: '/pack/new',
      params: { templateId: packTemplate.id },
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
                onPress={() => addPackTemplateItemActionsRef.current?.present()}
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

      <AddPackTemplateItemActions
        ref={addPackTemplateItemActionsRef}
        packTemplateId={id as string}
      />
    </SafeAreaView>
  );
}
