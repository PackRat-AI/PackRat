import type { LargeTitleSearchBarRef } from '@packrat/ui/nativewindui';
import { LargeTitleHeader, SegmentedControl } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import type { PackCategory } from 'expo-app/features/packs/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { Link, useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TemplateCard } from '../components/TemplateCard';
import { usePackTemplates } from '../hooks';
import { activeTemplateFilterAtom, templateSearchValueAtom } from '../packTemplateListAtoms';
import type { PackTemplate } from '../types';

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

function CreateTemplateIconButton() {
  const { colors } = useColorScheme();
  return (
    <Link href="/pack-templates/new" asChild>
      <Pressable>
        <Icon name="plus" color={colors.foreground} />
      </Pressable>
    </Link>
  );
}

export function PackTemplateListScreen() {
  const router = useRouter();
  const templates = usePackTemplates();
  const [searchValue, setSearchValue] = useAtom(templateSearchValueAtom);
  const [activeFilter, setActiveFilter] = useAtom(activeTemplateFilterAtom);
  const { isAuthenticated } = useAuth();
  const [selectedTemplateTypeIndex, setSelectedTemplateTypeIndex] = useState(0);

  const searchBarRef = useRef<LargeTitleSearchBarRef>(null);

  const handleTemplatePress = useCallback(
    (template: PackTemplate) => {
      router.push({
        pathname: '/pack-templates/[id]',
        params: { id: template.id },
      });
    },
    [router],
  );

  const handleCreatePackTemplate = () => {
    router.push({ pathname: '/pack-templates/new' });
  };

  const filteredTemplates =
    activeFilter === 'all'
      ? templates?.filter(
          (t) =>
            (selectedTemplateTypeIndex === 0
              ? true
              : selectedTemplateTypeIndex === 1
                ? t.isAppTemplate
                : !t.isAppTemplate) && t.name.toLowerCase().includes(searchValue.toLowerCase()),
        )
      : templates?.filter(
          (t) =>
            (selectedTemplateTypeIndex === 0
              ? true
              : selectedTemplateTypeIndex === 1
                ? t.isAppTemplate
                : !t.isAppTemplate) &&
            t.category === activeFilter &&
            t.name.toLowerCase().includes(searchValue.toLowerCase()),
        );

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

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title="Pack Templates"
        searchBar={{
          iosHideWhenScrolling: true,
          ref: asNonNullableRef(searchBarRef),
          onChangeText(text) {
            setSearchValue(text);
          },
        }}
        rightView={() => (
          <View className="flex-row items-center">
            <CreateTemplateIconButton />
          </View>
        )}
      />

      <FlatList
        data={filteredTemplates}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pt-4">
            <TemplateCard templateId={item.id} onPress={handleTemplatePress} />
          </View>
        )}
        ListHeaderComponent={
          <>
            <View className="bg-background px-4 py-2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                {filterOptions.map(renderFilterChip)}
              </ScrollView>
            </View>
            <View className="flex-row items-center justify-between gap-8 px-4 pb-0 pt-2">
              <Text className="text-muted-foreground">
                {filteredTemplates.length}{' '}
                {filteredTemplates.length === 1 ? 'template' : 'templates'}
              </Text>
              <View className="flex-1">
                <SegmentedControl
                  enabled={isAuthenticated}
                  values={['All', 'App', 'Yours']}
                  selectedIndex={selectedTemplateTypeIndex}
                  onIndexChange={(index) => {
                    setSelectedTemplateTypeIndex(index);
                  }}
                />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-4 rounded-full bg-muted p-4">
              <Icon name="cog-outline" size={32} color="text-muted-foreground" />
            </View>
            <Text className="mb-1 text-lg font-medium text-foreground">No templates found</Text>
            <Text className="mb-6 text-center text-muted-foreground">
              {activeFilter === 'all'
                ? "You haven't created any templates yet."
                : `No ${activeFilter} templates found.`}
            </Text>
            <TouchableOpacity
              className="rounded-lg bg-primary px-4 py-2"
              onPress={handleCreatePackTemplate}
            >
              <Text className="font-medium text-primary-foreground">Create Template</Text>
            </TouchableOpacity>
          </View>
        }
        // contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
