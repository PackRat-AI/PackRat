'use client';

import { AIChatTile } from '@packrat/app/ai/components/AIChatTile';
import { ReportedContentTile } from '@packrat/app/ai/components/ReportedContentTile';
import { AIPacksTile } from '@packrat/app/ai-packs/components/AIPacksTile';
import { AndroidTabBarInsetFix } from '@packrat/app/components/AndroidTabBarInsetFix';
import { Icon } from '@packrat/app/components/Icon';
import { LargeTitleHeaderSearchContentContainer } from '@packrat/app/components/LargeTitleHeaderSearchContentContainer';
import { FeedTile } from '@packrat/app/feed/components/FeedTile';
import { GuidesTile } from '@packrat/app/guides/components/GuidesTile';
import { cn } from '@packrat/app/lib/cn';
import { useTranslation } from '@packrat/app/lib/hooks/useTranslation';
import { asNonNullableRef } from '@packrat/app/lib/utils/asNonNullableRef';
import { PackTemplatesTile } from '@packrat/app/pack-templates/components/PackTemplatesTile';
import { CurrentPackTile } from '@packrat/app/packs/components/CurrentPackTile';
import { GearInventoryTile } from '@packrat/app/packs/components/GearInventoryTile';
import { PackCategoriesTile } from '@packrat/app/packs/components/PackCategoriesTile';
import { PackStatsTile } from '@packrat/app/packs/components/PackStatsTile';
import { RecentPacksTile } from '@packrat/app/packs/components/RecentPacksTile';
import { SeasonSuggestionsTile } from '@packrat/app/packs/components/SeasonSuggestionsTile';
import { SharedPacksTile } from '@packrat/app/packs/components/SharedPacksTile';
import { ShoppingListTile } from '@packrat/app/packs/components/ShoppingListTile';
import { WeightAnalysisTile } from '@packrat/app/packs/components/WeightAnalysisTile';
import { TrailConditionsTile } from '@packrat/app/trips/components/TrailConditionsTile';
import { UpcomingTripsTile } from '@packrat/app/trips/components/UpcomingTripsTile';
import { WeatherAlertsTile } from '@packrat/app/weather/components/WeatherAlertsTile';
import { WeatherTile } from '@packrat/app/weather/components/WeatherTile';
import { WildlifeTile } from '@packrat/app/wildlife/components/WildlifeTile';
import { arrayIncludes, assertIsString, objectKeys } from '@packrat/guards';
import type { LargeTitleSearchBarMethods, ListDataItem } from '@packrat/ui/nativewindui';
import {
  LargeTitleHeader,
  List,
  type ListRenderItemInfo,
  ListSectionHeader,
} from '@packrat/ui/nativewindui';
import { appConfig, featureFlags } from 'expo-app/config';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';

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
  'season-suggestions': {
    title: 'Season Suggestions',
    keywords: ['season', 'suggestions', 'ai', 'seasonal', 'weather', 'recommendations'],
    component: SeasonSuggestionsTile,
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
  'ai-packs': {
    title: 'AI Packs',
    keywords: ['ai', 'packs', 'generate', 'create'],
    component: AIPacksTile,
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
  guides: {
    title: 'Guides',
    keywords: ['guides', 'help', 'tutorial', 'documentation', 'learn'],
    component: GuidesTile,
  },
  feed: {
    title: 'Feed',
    keywords: ['feed', 'photos', 'social', 'share', 'posts'],
    component: FeedTile,
  },
  wildlife: {
    // Placeholder: title/keywords are overridden with locale-reactive values inside DashboardScreen
    title: 'Wildlife',
    keywords: [
      'wildlife',
      'identify',
      'plant',
      'flower',
      'tree',
      'bird',
      'mammal',
      'species',
      'nature',
      'animal',
      'offline',
    ],
    component: WildlifeTile,
  },
};

const TILE_NAMES = objectKeys(tileInfo);
const DASHBOARD_GAP_PREFIX = appConfig.dashboard.gapPrefix;

export default function DashboardScreen() {
  const [searchValue, setSearchValue] = useState('');
  const searchBarRef = useRef<LargeTitleSearchBarMethods>(null);
  const { t } = useTranslation();

  const localizedTileInfo = useMemo(
    () => ({
      ...tileInfo,
      wildlife: {
        ...tileInfo.wildlife,
        title: t('wildlife.wildlife'),
        keywords: [
          t('wildlife.wildlife').toLowerCase(),
          t('wildlife.identify').toLowerCase(),
          t('wildlife.category.plant'),
          t('wildlife.category.flower'),
          t('wildlife.category.tree'),
          t('wildlife.category.bird'),
          t('wildlife.category.mammal'),
          'species',
          'nature',
          'animal',
          'offline',
        ],
      },
    }),
    [t],
  );

  const dashboardLayout = useRef([
    ...appConfig.dashboard.layout.base,
    ...(featureFlags.enableTrips || featureFlags.enableTrailConditions
      ? [appConfig.dashboard.layout.conditional.tripsOrTrailSpacer]
      : []),
    ...(featureFlags.enableTrips ? [appConfig.dashboard.layout.conditional.trips] : []),
    ...(featureFlags.enableTrailConditions
      ? [appConfig.dashboard.layout.conditional.trailConditions]
      : []),
    ...appConfig.dashboard.layout.weatherSection,
    ...(featureFlags.enableTrips ? [appConfig.dashboard.layout.conditional.weatherAlerts] : []),
    ...appConfig.dashboard.layout.gearSection,
    ...(featureFlags.enableShoppingList
      ? [appConfig.dashboard.layout.conditional.shoppingList]
      : []),
    ...(featureFlags.enableSharedPacks ? [appConfig.dashboard.layout.conditional.sharedPacks] : []),
    ...(featureFlags.enablePackTemplates
      ? [appConfig.dashboard.layout.conditional.packTemplates]
      : []),
    ...(featureFlags.enableFeed ? [appConfig.dashboard.layout.conditional.feed] : []),
    ...appConfig.dashboard.layout.footerSection,
    ...(featureFlags.enableWildlifeIdentification
      ? [appConfig.dashboard.layout.conditional.wildlife]
      : []),
  ]).current;

  const filteredTiles = useMemo(() => {
    if (!searchValue.trim()) return [];

    const searchLower = searchValue.toLowerCase();
    return dashboardLayout.filter((item) => {
      if (!item.startsWith(DASHBOARD_GAP_PREFIX) && arrayIncludes(TILE_NAMES, item)) {
        const info = localizedTileInfo[item];
        return (
          info.title.toLowerCase().includes(searchLower) ||
          info.keywords.some((k) => k.toLowerCase().includes(searchLower))
        );
      }
      return false;
    });
  }, [searchValue, dashboardLayout, localizedTileInfo]);

  return (
    <>
      <LargeTitleHeader
        title={t('dashboard.title')}
        searchBar={{
          ref: asNonNullableRef(searchBarRef),
          onChangeText: setSearchValue,
          placeholder: appConfig.dashboard.strings.searchPlaceholder,
          content: (
            <LargeTitleHeaderSearchContentContainer>
              {searchValue ? (
                <FlatList
                  data={filteredTiles}
                  keyExtractor={keyExtractor}
                  contentContainerClassName="gap-4 px-4 pb-4"
                  renderItem={({ item }) => {
                    assertIsString(item);
                    if (!item.startsWith(DASHBOARD_GAP_PREFIX) && arrayIncludes(TILE_NAMES, item)) {
                      const Component = tileInfo[item].component;
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
                        {filteredTiles.length}{' '}
                        {filteredTiles.length === 1
                          ? appConfig.dashboard.strings.resultSingular
                          : appConfig.dashboard.strings.resultPlural}
                      </Text>
                    ) : null
                  }
                  ListEmptyComponent={() => (
                    <View className="items-center justify-center p-6">
                      <Icon name="file-search-outline" size={48} color="#9ca3af" />
                      <View className="h-4" />
                      <Text className="text-lg font-medium text-muted-foreground">
                        {t('dashboard.noResults')}
                      </Text>
                      <Text className="mt-1 text-center text-sm text-muted-foreground">
                        {t('dashboard.tryDifferent')}
                      </Text>
                    </View>
                  )}
                />
              ) : (
                <View className="flex-1 items-center justify-center p-4">
                  <Text className="text-muted-foreground">{t('dashboard.searchPlaceholder')}</Text>
                </View>
              )}
            </LargeTitleHeaderSearchContentContainer>
          ),
        }}
        backVisible={false}
      />

      <List
        contentContainerClassName="pt-4"
        contentInsetAdjustmentBehavior="automatic"
        variant="insets"
        data={dashboardLayout}
        renderItem={renderDashboardItem}
        keyExtractor={keyExtractor}
        sectionHeaderAsGap
        ListFooterComponent={
          <>
            <View className="h-12" />
            <AndroidTabBarInsetFix />
          </>
        }
      />
    </>
  );
}

function renderDashboardItem<T extends ListDataItem>(info: ListRenderItemInfo<T>) {
  const item = info.item as string;

  if (item.startsWith(DASHBOARD_GAP_PREFIX)) {
    return <ListSectionHeader {...info} />;
  }

  if (!arrayIncludes(TILE_NAMES, item)) return null;
  const TileItem = tileInfo[item].component;
  return (
    <View
      className={cn(
        'rounded-xl overflow-hidden',
        Platform.select({
          ios: 'mb-1',
          android: 'mb-0',
        }),
      )}
    >
      <TileItem />
    </View>
  );
}

function keyExtractor(item: string, _index: number) {
  return item;
}
