'use client';

import { Icon } from '@roninoss/icons';
import { Link } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import type { LargeTitleSearchBarRef } from 'nativewindui/LargeTitleHeader/types';
import {
  ESTIMATED_ITEM_HEIGHT,
  List,
  type ListRenderItemInfo,
  ListSectionHeader,
} from 'nativewindui/List';
import { featureFlags } from '~/config';
import { AIChatTile } from '~/features/ai/components/AIChatTile';
import { PackTemplatesTile } from '~/features/pack-templates/components/PackTemplatesTile';
import { CurrentPackTile } from '~/features/packs/components/CurrentPackTile';
import { GearInventoryTile } from '~/features/packs/components/GearInventoryTile';
import { PackCategoriesTile } from '~/features/packs/components/PackCategoriesTile';
import { PackStatsTile } from '~/features/packs/components/PackStatsTile';
import { RecentPacksTile } from '~/features/packs/components/RecentPacksTile';
import { SharedPacksTile } from '~/features/packs/components/SharedPacksTile';
import { ShoppingListTile } from '~/features/packs/components/ShoppingListTile';
import { WeightAnalysisTile } from '~/features/packs/components/WeightAnalysisTile';
import { TrailConditionsTile } from '~/features/trips/components/TrailConditionsTile';
import { UpcomingTripsTile } from '~/features/trips/components/UpcomingTripsTile';
import { WeatherAlertsTile } from '~/features/weather/components/WeatherAlertsTile';
import { WeatherTile } from '~/features/weather/components/WeatherTile';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/useColorScheme';

// Define tile metadata for search functionality
const tileMetadata = {
  'current-pack': { title: 'Current Pack', keywords: ['active', 'current', 'pack'] },
  'recent-packs': { title: 'Recent Packs', keywords: ['recent', 'packs', 'history'] },
  'ask-packrat-ai': { title: 'Ask PackRat AI', keywords: ['ai', 'chat', 'assistant', 'help'] },
  'pack-stats': { title: 'Pack Statistics', keywords: ['stats', 'statistics', 'analytics'] },
  'weight-analysis': {
    title: 'Weight Analysis',
    keywords: ['weight', 'analysis', 'heavy', 'light'],
  },
  'pack-categories': { title: 'Pack Categories', keywords: ['categories', 'organize', 'group'] },
  'upcoming-trips': {
    title: 'Upcoming Trips',
    keywords: ['trips', 'upcoming', 'planned', 'schedule'],
  },
  'trail-conditions': {
    title: 'Trail Conditions',
    keywords: ['trail', 'conditions', 'terrain', 'path'],
  },
  weather: { title: 'Weather', keywords: ['weather', 'forecast', 'temperature', 'conditions'] },
  'weather-alerts': {
    title: 'Weather Alerts',
    keywords: ['weather', 'alerts', 'warnings', 'emergency'],
  },
  'gear-inventory': {
    title: 'Gear Inventory',
    keywords: ['gear', 'inventory', 'equipment', 'items'],
  },
  'shopping-list': { title: 'Shopping List', keywords: ['shopping', 'list', 'buy', 'purchase'] },
  'shared-packs': {
    title: 'Shared Packs',
    keywords: ['shared', 'packs', 'collaborate', 'friends'],
  },
  'pack-templates': { title: 'Pack Templates', keywords: ['templates', 'preset', 'pattern'] },
};

function SettingsIcon() {
  const { colors } = useColorScheme();
  return (
    <Link href="/modal" asChild>
      <Pressable className="opacity-80">
        {({ pressed }) => (
          <View className={cn(pressed ? 'opacity-50' : 'opacity-90')}>
            <Icon name="cog-outline" color={colors.foreground} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function DemoIcon() {
  const { colors } = useColorScheme();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Link href="/demo" asChild>
      <Pressable className="opacity-80">
        {({ pressed }) => (
          <View className={cn(pressed ? 'opacity-50' : 'opacity-90')}>
            <Icon name="tag-outline" color={colors.foreground} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

export default function DashboardScreen() {
  const [searchValue, setSearchValue] = useState('');
  const searchBarRef = useRef<LargeTitleSearchBarRef>(null);

  const dashboardLayout = useRef([
    { id: 'current-pack', component: CurrentPackTile },
    { id: 'recent-packs', component: RecentPacksTile },
    'gap 1',
    { id: 'ask-packrat-ai', component: AIChatTile },
    'gap 1.5',
    { id: 'pack-stats', component: PackStatsTile },
    { id: 'weight-analysis', component: WeightAnalysisTile },
    { id: 'pack-categories', component: PackCategoriesTile },
    ...(featureFlags.enableTrips
      ? [
          'gap 2',
          { id: 'upcoming-trips', component: UpcomingTripsTile },
          { id: 'trail-conditions', component: TrailConditionsTile },
        ]
      : []),
    'gap 2.5',
    { id: 'weather', component: WeatherTile },
    ...(featureFlags.enableTrips ? [{ id: 'weather-alerts', component: WeatherAlertsTile }] : []),
    'gap 3',
    { id: 'gear-inventory', component: GearInventoryTile },
    ...(featureFlags.enableShoppingList
      ? [{ id: 'shopping-list', component: ShoppingListTile }]
      : []),
    ...(featureFlags.enableSharedPacks ? [{ id: 'shared-packs', component: SharedPacksTile }] : []),
    ...(featureFlags.enablePackTemplates
      ? [{ id: 'pack-templates', component: PackTemplatesTile }]
      : []),
  ]).current;

  // Filter dashboard tiles based on search value
  const filteredTiles = useMemo(() => {
    if (!searchValue.trim()) {
      return [];
    }

    const searchLower = searchValue.toLowerCase();

    return dashboardLayout.filter((item) => {
      if (typeof item === 'object' && item.id) {
        const metadata = tileMetadata[item.id];
        if (metadata) {
          // Check if title or any keywords match
          return (
            metadata.title.toLowerCase().includes(searchLower) ||
            metadata.keywords.some((keyword) => keyword.toLowerCase().includes(searchLower))
          );
        }
      }
      return false;
    });
  }, [searchValue, dashboardLayout]);

  return (
    <View className="flex-1">
      <LargeTitleHeader
        title="Dashboard"
        searchBar={{
          ref: searchBarRef,
          iosHideWhenScrolling: true,
          onChangeText(text) {
            setSearchValue(text);
          },
          placeholder: 'Search...',
          content: searchValue ? (
            <FlatList
              data={filteredTiles}
              keyExtractor={keyExtractor}
              className="space-y-4 px-4"
              renderItem={({ item }) => {
                if (typeof item === 'object' && item.component) {
                  const Component = item.component;
                  return (
                    <Pressable
                      key={item.id}
                      className="py-2"
                      onPress={() => {
                        setSearchValue('');
                        searchBarRef.current?.clearText();
                      }}
                    >
                      <Component />
                    </Pressable>
                  );
                }
                return null;
              }}
              ListHeaderComponent={() =>
                filteredTiles.length > 0 ? (
                  <Text className="px-4 py-2 text-sm text-muted-foreground">
                    {filteredTiles.length} {filteredTiles.length === 1 ? 'result' : 'results'}
                  </Text>
                ) : null
              }
              ListEmptyComponent={() => (
                <View className="items-center justify-center p-6">
                  <Icon name="file-search-outline" size={48} color="#9ca3af" />
                  <View className="h-4" />
                  <View className="items-center">
                    <Text className="text-lg font-medium text-muted-foreground">
                      No matching tiles found
                    </Text>
                    <Text className="mt-1 text-center text-sm text-muted-foreground">
                      Try different keywords or clear your search
                    </Text>
                  </View>
                </View>
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center p-4">
              <Text className="text-muted-foreground">Search dashboard</Text>
            </View>
          ),
        }}
        backVisible={false}
        rightView={() => (
          <View className="flex-row items-center gap-2 pr-2">
            <DemoIcon />
            <SettingsIcon />
          </View>
        )}
      />

      <List
        contentContainerClassName="pt-4"
        contentInsetAdjustmentBehavior="automatic"
        variant="insets"
        data={dashboardLayout}
        estimatedItemSize={ESTIMATED_ITEM_HEIGHT.titleOnly}
        renderItem={renderDashboardItem}
        keyExtractor={keyExtractor}
        sectionHeaderAsGap
      />
    </View>
  );
}

function renderDashboardItem(info: ListRenderItemInfo<any>) {
  const item = info.item;

  if (typeof item === 'string') {
    return <ListSectionHeader {...info} />;
  }

  const Component = item.component;
  return <Component />;
}

function keyExtractor(item: any) {
  if (typeof item === 'string') {
    return item;
  }
  return item.id;
}
