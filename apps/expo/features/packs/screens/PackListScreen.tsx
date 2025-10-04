import type { LargeTitleSearchBarRef } from '@packrat/ui/nativewindui';
import {
  ActivityIndicator,
  Button,
  LargeTitleHeader,
  SegmentedControl,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { PackCard } from 'expo-app/features/packs/components/PackCard';
import { SearchResults } from 'expo-app/features/packs/components/SearchResults';
import SyncBanner from 'expo-app/features/packs/components/SyncBanner';
import { activeFilterAtom, searchValueAtom } from 'expo-app/features/packs/packListAtoms';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAllPacks } from '../hooks/useAllPacks';
import { usePacks } from '../hooks/usePacks';
import type { Pack, PackCategory, PackInStore } from '../types';

type FilterOption = {
  label: string;
  value: PackCategory | 'all';
};

const filterOptions: FilterOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Hiking', value: 'hiking' },
  { label: 'Backpacking', value: 'backpacking' },
  { label: 'Camping', value: 'camping' },
  { label: 'Climbing', value: 'climbing' },
  { label: 'Winter', value: 'winter' },
  { label: 'Desert', value: 'desert' },
  { label: 'Custom', value: 'custom' },
];

function CreatePackIconButton() {
  const { colors } = useColorScheme();
  const router = useRouter();

  const handleCreatePress = () => {
    Alert.alert('Create Pack', 'Choose how to create your pack', [
      {
        text: 'From Photo',
        onPress: () => router.push('/pack/new-from-image'),
      },
      {
        text: 'Manual',
        onPress: () => router.push('/pack/new'),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  return (
    <Pressable onPress={handleCreatePress}>
      <Icon name="plus" color={colors.foreground} />
    </Pressable>
  );
}

const USER_PACKS_INDEX = 0;
const ALL_PACKS_INDEX = 1;

export function PackListScreen() {
  const router = useRouter();
  const userPacks = usePacks();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useAtom(activeFilterAtom);
  const { isAuthenticated } = useAuth();
  const { view } = useLocalSearchParams();
  const isAllPacksView = view === 'all';
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(
    isAllPacksView ? ALL_PACKS_INDEX : USER_PACKS_INDEX,
  );
  const allPacksQuery = useAllPacks(selectedTypeIndex === ALL_PACKS_INDEX);

  const searchBarRef = useRef<LargeTitleSearchBarRef>(null);

  const packs = selectedTypeIndex === USER_PACKS_INDEX ? userPacks : allPacksQuery.data;

  const filteredPacks = packs?.filter((pack) => {
    const matchesSearch = pack.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesCategory = activeFilter === 'all' || pack.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  const handlePackPress = useCallback(
    (pack: Pack | PackInStore) => {
      router.push({
        pathname: '/pack/[id]',
        params: { id: pack.id },
      });
    },
    [router],
  );

  const handleCreatePack = () => {
    Alert.alert('Create Pack', 'Choose how to create your pack', [
      {
        text: 'From Photo',
        onPress: () => router.push('/pack/new-from-image'),
      },
      {
        text: 'Manual',
        onPress: () => router.push('/pack/new'),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleRetryAllPacks = () => {
    allPacksQuery.refetch();
  };

  const renderFilterChip = ({ label, value }: FilterOption) => (
    <TouchableOpacity
      key={value}
      onPress={() => setActiveFilter(value)}
      className={`mr-2 rounded-full px-4 py-2 ${activeFilter === value ? 'bg-primary' : 'bg-card'}`}
    >
      <Text
        className={`text-sm font-medium ${activeFilter === value ? 'text-primary-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const handleSearchResultPress = useCallback(
    (pack: Pack | PackInStore) => {
      handlePackPress(pack);
    },
    [handlePackPress],
  );

  const renderAllPacksEmptyState = () => {
    if (allPacksQuery.isLoading) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator />
        </View>
      );
    }

    if (allPacksQuery.isError) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <View className="bg-destructive/10 mb-4 rounded-full p-4">
            <Icon name="exclamation" size={32} color="text-destructive" />
          </View>
          <Text className="mb-2 text-lg font-medium text-foreground">Failed to load packs</Text>
          <Text className="mb-6 text-center text-muted-foreground">
            {allPacksQuery.error?.message || 'Something went wrong. Please try again.'}
          </Text>
          <View className="flex-row justify-center">
            <Button variant="secondary" onPress={handleRetryAllPacks}>
              <Text>Try Again</Text>
            </Button>
          </View>
        </View>
      );
    }

    // No packs found (success state but empty data)
    return (
      <View className="flex-1 items-center justify-center p-8">
        <View className="mb-4 rounded-full bg-muted p-4">
          <Icon name="basket-outline" size={32} color="text-muted-foreground" />
        </View>
        <Text className="mb-2 text-lg font-medium text-foreground">
          No {activeFilter === 'all' ? '' : activeFilter} packs found
        </Text>
        <Text className="mb-6 text-center text-muted-foreground">
          {activeFilter === 'all'
            ? 'No public packs are available at the moment.'
            : `No public ${activeFilter} packs are available.`}
        </Text>
        <TouchableOpacity className="rounded-lg bg-primary px-4 py-2" onPress={handleCreatePack}>
          <Text className="font-medium text-primary-foreground">Create New Pack</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title="Packs"
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: true,
          ref: asNonNullableRef(searchBarRef),
          onChangeText(text) {
            setSearchValue(text);
          },
          content: searchValue ? (
            <SearchResults
              results={filteredPacks || []}
              searchValue={searchValue}
              onResultPress={handleSearchResultPress}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text>Search packs</Text>
            </View>
          ),
        }}
        rightView={() => (
          <View className="flex-row items-center">
            <CreatePackIconButton />
          </View>
        )}
      />

      <FlatList
        data={filteredPacks}
        keyExtractor={(pack) => pack.id}
        renderItem={({ item: pack }) => (
          <View className="px-4 pt-4">
            <PackCard pack={pack} onPress={handlePackPress} />
          </View>
        )}
        ListHeaderComponent={
          <>
            {!isAuthenticated && <SyncBanner />}
            {isAuthenticated && (
              <View className="px-4">
                <SegmentedControl
                  enabled={isAuthenticated}
                  values={['My Packs', 'All Packs']}
                  selectedIndex={selectedTypeIndex}
                  onIndexChange={(index) => {
                    setSelectedTypeIndex(index);
                  }}
                />
              </View>
            )}
            <View className="bg-background px-4 py-2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                {filterOptions.map(renderFilterChip)}
              </ScrollView>
            </View>
            {selectedTypeIndex === USER_PACKS_INDEX && (
              <View className="px-6 pb-0 pt-2">
                <Text className="flex-1 text-muted-foreground">
                  {filteredPacks?.length || 0} {filteredPacks?.length === 1 ? 'pack' : 'packs'}
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          selectedTypeIndex === ALL_PACKS_INDEX ? (
            renderAllPacksEmptyState()
          ) : (
            <View className="flex-1 items-center justify-center p-8">
              <View className="mb-4 rounded-full bg-muted p-4">
                <Icon name="cog-outline" size={32} color="text-muted-foreground" />
              </View>
              <Text className="mb-1 text-lg font-medium text-foreground">No packs found</Text>
              <Text className="mb-6 text-center text-muted-foreground">
                {activeFilter === 'all'
                  ? "You haven't created or found any public packs yet."
                  : `You don't have any ${activeFilter} packs.`}
              </Text>
              <TouchableOpacity
                className="rounded-lg bg-primary px-4 py-2"
                onPress={handleCreatePack}
              >
                <Text className="font-medium text-primary-foreground">Create New Pack</Text>
              </TouchableOpacity>
            </View>
          )
        }
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
