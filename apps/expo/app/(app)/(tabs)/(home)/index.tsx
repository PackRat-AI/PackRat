'use client';

import type { LargeTitleSearchBarRef, ListDataItem } from '@packrat/ui/nativewindui';
import {
  ESTIMATED_ITEM_HEIGHT,
  LargeTitleHeader,
  List,
  type ListRenderItemInfo,
  ListSectionHeader,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { featureFlags } from 'expo-app/config';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { AIChatTile } from 'expo-app/features/ai/components/AIChatTile';
import { ReportedContentTile } from 'expo-app/features/ai/components/ReportedContentTile';
import { PackTemplatesTile } from 'expo-app/features/pack-templates/components/PackTemplatesTile';
import { CurrentPackTile } from 'expo-app/features/packs/components/CurrentPackTile';
import { GearInventoryTile } from 'expo-app/features/packs/components/GearInventoryTile';
import { PackCategoriesTile } from 'expo-app/features/packs/components/PackCategoriesTile';
import { PackStatsTile } from 'expo-app/features/packs/components/PackStatsTile';
import { RecentPacksTile } from 'expo-app/features/packs/components/RecentPacksTile';
import { SharedPacksTile } from 'expo-app/features/packs/components/SharedPacksTile';
import { ShoppingListTile } from 'expo-app/features/packs/components/ShoppingListTile';
import { WeightAnalysisTile } from 'expo-app/features/packs/components/WeightAnalysisTile';
import { TrailConditionsTile } from 'expo-app/features/trips/components/TrailConditionsTile';
import { UpcomingTripsTile } from 'expo-app/features/trips/components/UpcomingTripsTile';
import { WeatherAlertsTile } from 'expo-app/features/weather/components/WeatherAlertsTile';
import { WeatherTile } from 'expo-app/features/weather/components/WeatherTile';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { assertIsString } from 'expo-app/utils/typeAssertions';
import { Link } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

const tileInfo = {
  'current-pack': {
    title: 'Current Pack',
    keywords: ['active', 'current', 'pack'],
    component: CurrentPackTile,
  },
  'recent-packs': {
    title: 'Recent Packs',
    keywords: ['recent', 'packs', 'history'],
    component: RecentPacksTile,
  },
  'ask-packrat-ai': {
    title: 'Ask PackRat AI',
    keywords: ['ai', 'chat', 'assistant', 'help'],
    component: AIChatTile,
  },
  'reported-ai-content': {
    title: 'Reported AI Content',
    keywords: ['reported', 'ai', 'content', 'flagged'],
    component: ReportedContentTile,
  },
  'pack-stats': {
    title: 'Pack Statistics',
    keywords: ['stats', 'statistics', 'analytics'],
    component: PackStatsTile,
  },
  'weight-analysis': {
    title: 'Weight Analysis',
    keywords: ['weight', 'analysis', 'heavy', 'light'],
    component: WeightAnalysisTile,
  },
  'pack-categories': {
    title: 'Pack Categories',
    keywords: ['categories', 'organize', 'group'],
    component: PackCategoriesTile,
  },
  'upcoming-trips': {
    title: 'Upcoming Trips',
    keywords: ['trips', 'upcoming', 'planned', 'schedule'],
    component: UpcomingTripsTile,
  },
  'trail-conditions': {
    title: 'Trail Conditions',
    keywords: ['trail', 'conditions', 'terrain', 'path'],
    component: TrailConditionsTile,
  },
  weather: {
    title: 'Weather',
    keywords: ['weather', 'forecast', 'temperature', 'conditions'],
    component: WeatherTile,
  },
  'weather-alerts': {
    title: 'Weather Alerts',
    keywords: ['weather', 'alerts', 'warnings', 'emergency'],
    component: WeatherAlertsTile,
  },
  'gear-inventory': {
    title: 'Gear Inventory',
    keywords: ['gear', 'inventory', 'equipment', 'items'],
    component: GearInventoryTile,
  },
  'shopping-list': {
    title: 'Shopping List',
    keywords: ['shopping', 'list', 'buy', 'purchase'],
    component: ShoppingListTile,
  },
  'shared-packs': {
    title: 'Shared Packs',
    keywords: ['shared', 'packs', 'collaborate', 'friends'],
    component: SharedPacksTile,
  },
  'pack-templates': {
    title: 'Pack Templates',
    keywords: ['templates', 'preset', 'pattern'],
    component: PackTemplatesTile,
  },
};

type TileName = keyof typeof tileInfo;

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
  if (clientEnvs.NODE_ENV !== 'development') return null;

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
    'current-pack',
    'recent-packs',
    'gap 1',
    'ask-packrat-ai',
    'reported-ai-content',
    'gap 1.5',
    'pack-stats',
    'weight-analysis',
    'pack-categories',
    ...(featureFlags.enableTrips ? ['gap 2', 'upcoming-trips', 'trail-conditions'] : []),
    'gap 2.5',
    'weather',
    ...(featureFlags.enableTrips ? ['weather-alerts'] : []),
    'gap 3',
    'gear-inventory',
    ...(featureFlags.enableShoppingList ? ['shopping-list'] : []),
    ...(featureFlags.enableSharedPacks ? ['shared-packs'] : []),
    ...(featureFlags.enablePackTemplates ? ['pack-templates'] : []),
  ]).current;

  const filteredTiles = useMemo(() => {
    if (!searchValue.trim()) return [];

    const searchLower = searchValue.toLowerCase();
    return dashboardLayout.filter((item) => {
      if (!item.startsWith('gap')) {
        const info = tileInfo[item as TileName];
        return (
          info.title.toLowerCase().includes(searchLower) ||
          info.keywords.some((k) => k.toLowerCase().includes(searchLower))
        );
      }
      return false;
    });
  }, [searchValue, dashboardLayout]);

  return (
    <View className="flex-1">
      <LargeTitleHeader
        title="Dashboard"
        searchBar={{
          ref: asNonNullableRef(searchBarRef),
          iosHideWhenScrolling: true,
          onChangeText: setSearchValue,
          placeholder: 'Search...',
          content: searchValue ? (
            <FlatList
              data={filteredTiles}
              keyExtractor={keyExtractor}
              className="space-y-4 px-4"
              renderItem={({ item }) => {
                assertIsString(item);
                if (!item.startsWith('gap')) {
                  const Component = tileInfo[item as TileName].component;
                  return (
                    <Pressable
                      key={item}
                      className="rounded-2xl overflow-hidden "
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
                  <Text className="text-lg font-medium text-muted-foreground">
                    No matching tiles found
                  </Text>
                  <Text className="mt-1 text-center text-sm text-muted-foreground">
                    Try different keywords or clear your search
                  </Text>
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
        contentContainerClassName="pt-4 pb-18"
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

function renderDashboardItem<T extends ListDataItem>(info: ListRenderItemInfo<T>) {
  const item = info.item as string;

  if (item.startsWith('gap')) {
    return <ListSectionHeader {...info} />;
  }

  const TileItem = tileInfo[item as TileName].component;
  return (
    <View className=" rounded-xl overflow-hidden ">
      <TileItem />
    </View>
  );
}

function keyExtractor(item: string, _index: number) {
  return item;
}
