const GAP_PREFIX = 'gap ';

const FeatureFlag = Object.freeze({
  EnableOAuth: 'enableOAuth',
  EnableTrips: 'enableTrips',
  EnablePackInsights: 'enablePackInsights',
  EnableShoppingList: 'enableShoppingList',
  EnableSharedPacks: 'enableSharedPacks',
  EnablePackTemplates: 'enablePackTemplates',
  EnableTrailConditions: 'enableTrailConditions',
  EnableFeed: 'enableFeed',
  EnableWildlifeIdentification: 'enableWildlifeIdentification',
});

const DashboardTileId = Object.freeze({
  CurrentPack: 'current-pack',
  RecentPacks: 'recent-packs',
  SeasonSuggestions: 'season-suggestions',
  AskPackRatAi: 'ask-packrat-ai',
  ReportedAiContent: 'reported-ai-content',
  AiPacks: 'ai-packs',
  PackStats: 'pack-stats',
  WeightAnalysis: 'weight-analysis',
  PackCategories: 'pack-categories',
  UpcomingTrips: 'upcoming-trips',
  TrailConditions: 'trail-conditions',
  Weather: 'weather',
  WeatherAlerts: 'weather-alerts',
  GearInventory: 'gear-inventory',
  ShoppingList: 'shopping-list',
  SharedPacks: 'shared-packs',
  PackTemplates: 'pack-templates',
  Feed: 'feed',
  Guides: 'guides',
  Wildlife: 'wildlife',
});

const DashboardLayoutId = Object.freeze({
  Gap1: `${GAP_PREFIX}1`,
  Gap15: `${GAP_PREFIX}1.5`,
  Gap2: `${GAP_PREFIX}2`,
  Gap25: `${GAP_PREFIX}2.5`,
  Gap3: `${GAP_PREFIX}3`,
  Gap4: `${GAP_PREFIX}4`,
});

function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;

  const record = value as Record<string, unknown>;
  for (const nestedValue of Object.values(record)) {
    deepFreeze(nestedValue);
  }

  return Object.freeze(value);
}

const APP_CONFIG_RAW = {
  featureFlags: {
    [FeatureFlag.EnableOAuth]: true,
    [FeatureFlag.EnableTrips]: true,
    [FeatureFlag.EnablePackInsights]: false,
    [FeatureFlag.EnableShoppingList]: false,
    [FeatureFlag.EnableSharedPacks]: false,
    [FeatureFlag.EnablePackTemplates]: true,
    [FeatureFlag.EnableTrailConditions]: false,
    [FeatureFlag.EnableFeed]: false,
    [FeatureFlag.EnableWildlifeIdentification]: false,
  },
  dashboard: {
    gapPrefix: GAP_PREFIX,
    strings: {
      searchPlaceholder: 'Search...',
      resultSingular: 'result',
      resultPlural: 'results',
    },
    layout: {
      base: [
        DashboardTileId.CurrentPack,
        DashboardTileId.RecentPacks,
        DashboardTileId.SeasonSuggestions,
        DashboardLayoutId.Gap1,
        DashboardTileId.AskPackRatAi,
        DashboardTileId.ReportedAiContent,
        DashboardTileId.AiPacks,
        DashboardLayoutId.Gap15,
        DashboardTileId.PackStats,
        DashboardTileId.WeightAnalysis,
        DashboardTileId.PackCategories,
      ],
      weatherAndLater: [
        DashboardLayoutId.Gap25,
        DashboardTileId.Weather,
        DashboardLayoutId.Gap3,
        DashboardTileId.GearInventory,
        DashboardLayoutId.Gap4,
        DashboardTileId.Guides,
      ],
      conditional: {
        tripsOrTrailSpacer: DashboardLayoutId.Gap2,
        trips: DashboardTileId.UpcomingTrips,
        trailConditions: DashboardTileId.TrailConditions,
        weatherAlerts: DashboardTileId.WeatherAlerts,
        shoppingList: DashboardTileId.ShoppingList,
        sharedPacks: DashboardTileId.SharedPacks,
        packTemplates: DashboardTileId.PackTemplates,
        feed: DashboardTileId.Feed,
        wildlife: DashboardTileId.Wildlife,
      },
    },
  },
} as const;

const APP_CONFIG = deepFreeze(APP_CONFIG_RAW);

export { APP_CONFIG, DashboardLayoutId, DashboardTileId, FeatureFlag };
