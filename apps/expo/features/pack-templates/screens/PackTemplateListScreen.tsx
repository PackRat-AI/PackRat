import type { LargeTitleSearchBarRef } from '@packrat/ui/nativewindui';
import { LargeTitleHeader, SegmentedControl } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import type { PackCategory } from 'expo-app/features/packs/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
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
import { PackTemplateCard } from '../components/PackTemplateCard';
import { usePackTemplates } from '../hooks';
import { activeTemplateFilterAtom, templateSearchValueAtom } from '../packTemplateListAtoms';
import type { PackTemplate } from '../types';

type FilterOption = {
  label: string;
  value: PackCategory | 'all';
};

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
  const { t } = useTranslation();

  const searchBarRef = useRef<LargeTitleSearchBarRef>(null);

  // Filter options with translations
  const filterOptions: FilterOption[] = [
    { label: t('packTemplates.all'), value: 'all' },
    { label: t('packTemplates.hiking'), value: 'hiking' },
    { label: t('packTemplates.backpacking'), value: 'backpacking' },
    { label: t('packTemplates.camping'), value: 'camping' },
    { label: t('packTemplates.climbing'), value: 'climbing' },
    { label: t('packTemplates.winter'), value: 'winter' },
    { label: t('packTemplates.desert'), value: 'desert' },
    { label: t('packTemplates.custom'), value: 'custom' },
  ];

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
        title={t('packTemplates.packTemplates')}
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

      <View className="bg-background gap-2 px-4 pb-2">
        <SegmentedControl
          enabled={isAuthenticated}
          values={[t('packTemplates.all'), t('packTemplates.app'), t('packTemplates.yours')]}
          selectedIndex={selectedTemplateTypeIndex}
          onIndexChange={(index) => {
            setSelectedTemplateTypeIndex(index);
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
          {filterOptions.map(renderFilterChip)}
        </ScrollView>
      </View>
      <FlatList
        data={filteredTemplates}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pt-4">
            <PackTemplateCard templateId={item.id} onPress={handleTemplatePress} />
          </View>
        )}
        ListHeaderComponent={
          <View className="px-4 pb-0 pt-2">
            <Text className="text-muted-foreground">
              {filteredTemplates.length}{' '}
              {filteredTemplates.length === 1
                ? t('packTemplates.template')
                : t('packTemplates.templates')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-4 rounded-full bg-muted p-4">
              <Icon name="cog-outline" size={32} color="text-muted-foreground" />
            </View>
            <Text className="mb-1 text-lg font-medium text-foreground">
              {t('packTemplates.noTemplatesFound')}
            </Text>
            <Text className="mb-6 text-center text-muted-foreground">
              {activeFilter === 'all'
                ? t('packTemplates.noTemplatesCreated')
                : t('packTemplates.noTemplatesInCategory', { category: activeFilter })}
            </Text>
            <TouchableOpacity
              className="rounded-lg bg-primary px-4 py-2"
              onPress={handleCreatePackTemplate}
            >
              <Text className="font-medium text-primary-foreground">
                {t('packTemplates.createTemplate')}
              </Text>
            </TouchableOpacity>
          </View>
        }
        // contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
