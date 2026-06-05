import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { SearchInput } from 'expo-app/components/SearchInput';
import { useDetailedPacks } from 'expo-app/features/packs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PackSelectionScreen() {
  const router = useRouter();
  const { catalogItemId } = useLocalSearchParams();
  const packs = useDetailedPacks();
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const filteredPacks = useMemo(() => {
    if (!packs) return [];

    if (searchQuery.trim() === '') {
      return packs;
    }

    const query = searchQuery.toLowerCase();
    return packs.filter(
      (pack) =>
        pack.name.toLowerCase().includes(query) ||
        pack.description?.toLowerCase().includes(query) ||
        pack.category.toLowerCase().includes(query),
    );
  }, [packs, searchQuery]);

  const handlePackSelect = (packId: string) => {
    router.push({
      pathname: '/catalog/add-to-pack/details',
      params: { catalogItemId, packId },
    });
  };

  const handleCreatePack = () => {
    router.push('/pack/new');
  };

  const EmptyState = (
    <View className="mx-4 mt-4 items-center justify-center rounded-lg bg-card p-8 shadow-sm">
      <Icon name="backpack" size={48} color="text-muted-foreground" />
      <Text variant="title3" color="primary" className="mt-4 text-center">
        {t('catalog.noPacksAvailable')}
      </Text>
      <Text variant="body" className="mb-4 text-center">
        {t('catalog.createPackMessage')}
      </Text>
      <Button onPress={handleCreatePack}>
        <Icon name="plus" size={18} color="text-primary-foreground" />
        <Text variant="body" color="primary">
          {t('catalog.createPack')}
        </Text>
      </Button>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Fixed: search + count label always visible */}
      <View className="border-b border-border bg-background px-4 pb-2 pt-3">
        <SearchInput
          textContentType="none"
          autoComplete="off"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {filteredPacks.length > 0 && (
          <Text variant="subhead" color="primary" className="mt-2">
            {t('catalog.selectPack', { count: filteredPacks.length })}
          </Text>
        )}
      </View>

      <FlatList
        data={filteredPacks}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          searchQuery.trim() !== '' ? (
            <View className="items-center justify-center px-4 py-8">
              <Text variant="body" className="text-center">
                {t('catalog.noPacksFound')}
              </Text>
            </View>
          ) : (
            EmptyState
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="mx-4 mb-3 overflow-hidden rounded-lg bg-card shadow-sm"
            onPress={() => handlePackSelect(item.id)}
            activeOpacity={0.7}
          >
            <View className="p-4 py-8">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 gap-4">
                  <Text variant="title3" color="primary">
                    {item.name}
                  </Text>
                  <View className="mt-1 flex-row flex-wrap items-center">
                    <View className="mr-3 flex-row items-center">
                      <Icon name="basket-outline" size={14} color={colors.grey2} />
                      <Text variant="caption2" className="ml-1">
                        {item.items?.length}{' '}
                        {item.items?.length === 1 ? t('catalog.item') : t('catalog.items')}
                      </Text>
                    </View>
                    <View className="mr-3 flex-row items-center">
                      <Icon name="dumbbell" size={14} color={colors.grey2} />
                      <Text variant="caption2" className="ml-1">
                        {item.baseWeight?.toFixed(2)} g
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Icon name="tag-outline" size={14} color={colors.grey2} />
                      <Text variant="caption2" className="ml-1 capitalize">
                        {item.category}
                      </Text>
                    </View>
                  </View>
                </View>
                <Icon name="chevron-right" size={20} color={colors.grey2} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
