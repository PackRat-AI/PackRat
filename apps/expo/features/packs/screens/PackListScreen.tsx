import { usePathname, useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@roninoss/icons';
import { Link } from 'expo-router';
import { activeFilterAtom, searchValueAtom } from 'expo-app/features/packs/packListAtoms';
import { PackCard } from 'expo-app/features/packs/components/PackCard';
import { usePacks } from 'expo-app/features/packs/hooks/usePacks';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import type { Pack, PackCategory } from '../types';
import SyncBanner from 'expo-app/features/packs/components/SyncBanner';
import { useCallback, useRef } from 'react';
import { SearchResults } from 'expo-app/features/packs/components/SearchResults';
import { LargeTitleSearchBarRef } from 'nativewindui/LargeTitleHeader/types';

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
  return (
    <Link href="/pack/new" asChild>
      <Pressable>
        <Icon name="plus" color={colors.foreground} />
      </Pressable>
    </Link>
  );
}

export function PackListScreen() {
  const router = useRouter();
  const packs = usePacks();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useAtom(activeFilterAtom);
  const { isAuthenticated } = useAuth();
  const route = usePathname();

  const searchBarRef = useRef<LargeTitleSearchBarRef>(null);

  const handlePackPress = useCallback(
    (pack: Omit<Pack, 'items' | 'baseWeight' | 'totalWeight'>) => {
      router.push({ pathname: '/pack/[id]', params: { id: pack.id } });
    },
    [router]
  );

  const handleCreatePack = () => {
    // Navigate to create pack screen
    router.push({ pathname: '/pack/new' });
  };

  const filteredPacks =
    activeFilter === 'all'
      ? packs?.filter((pack) => pack.name.toLowerCase().includes(searchValue.toLowerCase()))
      : packs?.filter(
          (pack) =>
            pack.category === activeFilter &&
            pack.name.toLowerCase().includes(searchValue.toLowerCase())
        );

  const renderFilterChip = ({ label, value }: FilterOption) => (
    <TouchableOpacity
      key={value}
      onPress={() => setActiveFilter(value)}
      className={`mr-2 rounded-full px-4 py-2 ${activeFilter === value ? 'bg-primary' : 'bg-card'}`}>
      <Text
        className={`text-sm font-medium ${activeFilter === value ? 'text-primary-foreground' : 'text-foreground'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const handleSearchResultPress = useCallback(
    (pack: Omit<Pack, 'items' | 'baseWeight' | 'totalWeight'>) => {
      // setSearchValue('');
      // searchBarRef.current?.clearText();
      // router.replace('/packs');
      handlePackPress(pack);
    },
    [handlePackPress]
  );

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title="My packs"
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: true,
          ref: searchBarRef,
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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pt-4">
            <PackCard packId={item.id} onPress={handlePackPress} />
          </View>
        )}
        ListHeaderComponent={
          <>
            {!isAuthenticated && <SyncBanner />}
            <View className="bg-background px-4 py-2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                {filterOptions.map(renderFilterChip)}
              </ScrollView>
            </View>
            <View className="px-4 pb-0 pt-2">
              <Text className="text-muted-foreground">
                {filteredPacks?.length} {filteredPacks?.length === 1 ? 'pack' : 'packs'}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-4 rounded-full bg-muted p-4">
              <Icon name="cog-outline" size={32} color="text-muted-foreground" />
            </View>
            <Text className="mb-1 text-lg font-medium text-foreground">No packs found</Text>
            <Text className="mb-6 text-center text-muted-foreground">
              {activeFilter === 'all'
                ? "You haven't created any packs yet."
                : `You don't have any ${activeFilter} packs.`}
            </Text>
            <TouchableOpacity
              className="rounded-lg bg-primary px-4 py-2"
              onPress={handleCreatePack}>
              <Text className="font-medium text-primary-foreground">Create New Pack</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
