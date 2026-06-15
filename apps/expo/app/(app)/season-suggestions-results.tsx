import { Text } from '@packrat/ui/nativewindui';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import * as Burnt from 'burnt';
import { Icon } from 'expo-app/components/Icon';
import { PackItemImage } from 'expo-app/features/packs/components/PackItemImage';
import { useCreatePackWithItems } from 'expo-app/features/packs/hooks/useCreatePackWithItems';
import {
  type PackSuggestion,
  SeasonSuggestionsError,
  useSeasonSuggestions,
} from 'expo-app/features/packs/hooks/useSeasonSuggestions';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SHIMMER_WIDTH = 140;

function ShimmerBox({ shimmerX, className }: { shimmerX: SharedValue<number>; className: string }) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View className={className} style={{ overflow: 'hidden' }}>
      <Animated.View
        style={[{ position: 'absolute', top: 0, bottom: 0, width: SHIMMER_WIDTH }, animStyle]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

function SuggestionSkeleton() {
  const { width } = useWindowDimensions();
  const shimmerX = useSharedValue(-SHIMMER_WIDTH);

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(width, { duration: 1300, easing: Easing.linear }), -1);
  }, [shimmerX, width]);

  return (
    <View className="gap-10">
      <View className="flex-row items-center gap-3">
        <ShimmerBox shimmerX={shimmerX} className="h-4 w-24 rounded-md bg-muted" />
        <View className="h-1 w-1 rounded-full bg-muted" />
        <ShimmerBox shimmerX={shimmerX} className="h-4 w-32 rounded-md bg-muted" />
      </View>

      {[0, 1, 2].map((i) => (
        <View key={i}>
          <View className="mb-3 flex-row items-center justify-between">
            <ShimmerBox shimmerX={shimmerX} className="h-6 w-44 rounded-lg bg-muted" />
            <ShimmerBox shimmerX={shimmerX} className="h-5 w-14 rounded-lg bg-muted" />
          </View>
          <ShimmerBox shimmerX={shimmerX} className="mb-1.5 h-3.5 w-20 rounded-md bg-muted" />
          <ShimmerBox shimmerX={shimmerX} className="mb-1.5 h-3.5 w-full rounded-md bg-muted" />
          <ShimmerBox shimmerX={shimmerX} className="mb-4 h-3.5 w-4/5 rounded-md bg-muted" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            className="-mx-4"
            contentContainerStyle={{ paddingLeft: 16, gap: 12 }}
          >
            {[0, 1, 2, 3].map((j) => (
              <View key={j} className="w-20 items-center gap-1.5">
                <ShimmerBox shimmerX={shimmerX} className="h-20 w-20 rounded-xl bg-muted" />
                <ShimmerBox shimmerX={shimmerX} className="h-3 w-14 rounded-md bg-muted" />
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

type ErrorKind = 'insufficient_inventory' | 'unauthenticated' | 'network' | 'ai' | 'generic';

function classifyError(error: unknown): ErrorKind {
  if (error instanceof SeasonSuggestionsError) {
    if (error.httpStatus === 400) return 'insufficient_inventory';
    if (error.httpStatus === 401) return 'unauthenticated';
    if (error.httpStatus >= 500) return 'ai';
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('connection')
  ) {
    return 'network';
  }
  return 'generic';
}

const ICON_CIRCLE: ViewStyle = { width: 72, height: 72, borderRadius: 36 };

// ---------------------------------------------------------------------------
// Dev-only error simulator — tree-shaken in production builds (__DEV__ = false)
// ---------------------------------------------------------------------------
const DEV_ERROR_CHIPS: { label: string; error: Error }[] = __DEV__
  ? [
      {
        label: '400',
        error: new SeasonSuggestionsError({
          httpStatus: 400,
          serverMessage: 'Insufficient inventory',
        }),
      },
      {
        label: '401',
        error: new SeasonSuggestionsError({ httpStatus: 401, serverMessage: 'Unauthorized' }),
      },
      { label: 'Net', error: new Error('Network request failed') },
      {
        label: 'AI',
        error: new SeasonSuggestionsError({
          httpStatus: 500,
          serverMessage: 'AI generation failed',
        }),
      },
      {
        label: '503',
        error: new SeasonSuggestionsError({
          httpStatus: 503,
          serverMessage: 'Service unavailable',
        }),
      },
    ]
  : [];

interface DevErrorPanelProps {
  active: Error | null;
  onSelect: (err: Error | null) => void;
}

function DevErrorPanel({ active, onSelect }: DevErrorPanelProps) {
  const { colors } = useColorScheme();
  return (
    <View
      className="mb-4 rounded-xl p-3"
      style={{ backgroundColor: colors.grey6, borderWidth: 1, borderColor: colors.grey4 }}
    >
      <Text variant="footnote" className="mb-2 font-semibold text-muted-foreground">
        🧪 Dev — Force error state
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {DEV_ERROR_CHIPS.map((chip) => {
          const isActive = active === chip.error;
          return (
            <TouchableOpacity
              key={chip.label}
              className="rounded-lg px-3 py-1.5"
              style={{
                backgroundColor: isActive ? colors.primary : colors.grey5,
              }}
              onPress={() => onSelect(isActive ? null : chip.error)}
              activeOpacity={0.7}
            >
              <Text
                variant="footnote"
                className="font-semibold"
                style={{ color: isActive ? 'white' : colors.foreground }}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {active !== null && (
          <TouchableOpacity
            className="rounded-lg px-3 py-1.5"
            style={{ backgroundColor: colors.grey5 }}
            onPress={() => onSelect(null)}
            activeOpacity={0.7}
          >
            <Text variant="footnote" className="font-semibold text-muted-foreground">
              ✕ Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface ErrorCardProps {
  error: unknown;
  onRetry: () => void;
  onGoBack: () => void;
  onGoToInventory: () => void;
  onSignIn: () => void;
}

function ErrorCard({ error, onRetry, onGoBack, onGoToInventory, onSignIn }: ErrorCardProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const kind = classifyError(error);

  const config = {
    insufficient_inventory: {
      sfSymbol: 'bag.badge.plus' as const,
      materialIcon: 'add-shopping-cart' as const,
      title: t('seasons.errorNotEnoughGearTitle'),
      body: t('seasons.errorNotEnoughGearBody'),
      primaryLabel: t('seasons.errorNotEnoughGearAction'),
      primaryAction: onGoToInventory,
      secondaryLabel: t('seasons.goBack'),
      secondaryAction: onGoBack,
    },
    unauthenticated: {
      sfSymbol: 'person.badge.key' as const,
      materialIcon: 'login' as const,
      title: t('seasons.errorSessionTitle'),
      body: t('seasons.errorSessionBody'),
      primaryLabel: t('seasons.errorSessionAction'),
      primaryAction: onSignIn,
      secondaryLabel: t('seasons.goBack'),
      secondaryAction: onGoBack,
    },
    network: {
      sfSymbol: 'wifi.slash' as const,
      materialIcon: 'wifi-off' as const,
      title: t('seasons.errorNetworkTitle'),
      body: t('seasons.errorNetworkBody'),
      primaryLabel: t('seasons.tryAgain'),
      primaryAction: onRetry,
      secondaryLabel: t('seasons.goBack'),
      secondaryAction: onGoBack,
    },
    ai: {
      sfSymbol: 'sparkles' as const,
      materialIcon: 'auto-awesome' as const,
      title: t('seasons.errorAiTitle'),
      body: t('seasons.errorAiBody'),
      primaryLabel: t('seasons.tryAgain'),
      primaryAction: onRetry,
      secondaryLabel: t('seasons.goBack'),
      secondaryAction: onGoBack,
    },
    generic: {
      sfSymbol: 'exclamationmark.circle' as const,
      materialIcon: 'error-outline' as const,
      title: t('seasons.errorGenericTitle'),
      body: t('seasons.errorGenericBody'),
      primaryLabel: t('seasons.tryAgain'),
      primaryAction: onRetry,
      secondaryLabel: t('seasons.goBack'),
      secondaryAction: onGoBack,
    },
  } as const;

  const {
    sfSymbol,
    materialIcon,
    title,
    body,
    primaryLabel,
    primaryAction,
    secondaryLabel,
    secondaryAction,
  } = config[kind];

  return (
    <View className="flex-1 items-center justify-center py-16 px-4">
      <View
        className="mb-6 items-center justify-center"
        style={[ICON_CIRCLE, { backgroundColor: colors.grey6 }]}
      >
        <Icon
          namingScheme="sfSymbol"
          name={sfSymbol}
          materialIcon={{ type: 'MaterialIcons', name: materialIcon }}
          size={30}
          color={colors.grey2}
        />
      </View>

      <Text variant="title3" className="mb-2 text-center font-semibold">
        {title}
      </Text>
      <Text variant="subhead" className="mb-8 text-center leading-relaxed text-muted-foreground">
        {body}
      </Text>

      <View className="w-full gap-3">
        <TouchableOpacity
          className="w-full items-center rounded-xl bg-primary px-6 py-3.5"
          onPress={primaryAction}
          activeOpacity={0.8}
        >
          <Text className="font-semibold text-white">{primaryLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full items-center rounded-xl px-6 py-3.5"
          style={{ backgroundColor: colors.grey6 }}
          onPress={secondaryAction}
          activeOpacity={0.8}
        >
          <Text className="font-medium text-muted-foreground">{secondaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SeasonSuggestionsResultsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { location, date } = useLocalSearchParams<{ location: string; date: string }>();
  const seasonSuggestions = useSeasonSuggestions();
  const createPackWithItems = useCreatePackWithItems();
  const [createdPacks, setCreatedPacks] = useState<Record<number, string>>({});
  const [devForcedError, setDevForcedError] = useState<Error | null>(null);
  const { colors } = useColorScheme();
  const triggered = useRef(false);

  const { mutate: triggerSuggestions } = seasonSuggestions;

  useEffect(() => {
    if (!triggered.current && location && date) {
      triggered.current = true;
      triggerSuggestions({ location, date });
    }
  }, [triggerSuggestions, location, date]);

  const handleRetry = () => {
    if (location && date) {
      seasonSuggestions.reset();
      triggerSuggestions({ location, date });
    }
  };

  const handleCreatePack = ({
    suggestion,
    index,
  }: {
    suggestion: PackSuggestion;
    index: number;
  }) => {
    const packId = createPackWithItems(suggestion);
    setCreatedPacks((prev) => ({ ...prev, [index]: packId }));
    Burnt.toast({ title: t('seasons.packCreated'), preset: 'done' });
  };

  const { data, error } = seasonSuggestions;
  const displayError = devForcedError ?? error;

  const handleDevRetry = () => {
    setDevForcedError(null);
  };

  return (
    <>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('seasons.seasonSuggestions') }} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 px-4">
        <View className="pt-6">
          {__DEV__ && <DevErrorPanel active={devForcedError} onSelect={setDevForcedError} />}

          {!displayError && !data && <SuggestionSkeleton />}

          {displayError && (
            <ErrorCard
              error={displayError}
              onRetry={devForcedError ? handleDevRetry : handleRetry}
              onGoBack={() => router.back()}
              onGoToInventory={() => router.push('/(app)/(tabs)/(home)')}
              onSignIn={() => router.replace('/auth')}
            />
          )}

          {data && !displayError && (
            <View>
              <View className="flex-row items-center gap-2 mb-4">
                <View className="flex-row items-center gap-1">
                  <Icon
                    namingScheme="sfSymbol"
                    name="leaf"
                    materialIcon={{ type: 'MaterialIcons', name: 'eco' }}
                    size={16}
                    color={colors.grey}
                  />
                  <Text className="text-base text-muted-foreground">{data.season}</Text>
                </View>
                <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                <View className="flex-row items-center gap-1">
                  <Icon
                    namingScheme="sfSymbol"
                    name="location"
                    materialIcon={{
                      type: 'MaterialIcons',
                      name: 'location-on',
                    }}
                    size={16}
                    color={colors.grey}
                  />
                  <Text className="text-base text-muted-foreground">{data.location}</Text>
                </View>
              </View>

              <View className="gap-10">
                {data.suggestions.map((suggestion, index) => (
                  <View key={suggestion.name}>
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-1.5 flex-1 mr-3">
                        <Text variant="heading" numberOfLines={1} className="flex-shrink">
                          {suggestion.name}
                        </Text>
                        <Icon
                          namingScheme="sfSymbol"
                          name="sparkles"
                          materialIcon={{
                            type: 'MaterialIcons',
                            name: 'auto-awesome',
                          }}
                          size={15}
                          color={colors.primary}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          createdPacks[index]
                            ? router.push(`/pack/${createdPacks[index]}`)
                            : handleCreatePack({ suggestion, index })
                        }
                      >
                        {createdPacks[index] ? (
                          <Text className="text-muted-foreground font-medium">
                            {t('common.view')}
                          </Text>
                        ) : (
                          <Text className="text-primary font-medium">{t('common.create')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <Text variant="caption1" className="text-primary font-medium mb-1">
                      {suggestion.category}
                    </Text>
                    <Text variant="body" className="text-muted-foreground mb-3">
                      {suggestion.description}
                    </Text>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="-mx-4"
                      contentContainerStyle={{
                        paddingHorizontal: 16,
                        gap: 12,
                      }}
                    >
                      {suggestion.items.map((item) => (
                        <View key={item.name} className="w-20 items-center">
                          <PackItemImage
                            item={{
                              id: item.id,
                              name: item.name,
                              weight: item.weight,
                              weightUnit: item.weightUnit,
                              quantity: item.quantity,
                              category: item.category ?? '',
                              consumable: item.consumable,
                              worn: item.worn,
                              image: item.image,
                              description: item.description ?? undefined,
                              notes: item.notes,
                              catalogItemId: item.catalogItemId,
                              packId: '',
                              deleted: false,
                              isAIGenerated: false,
                            }}
                            className="w-20 h-20 rounded-xl mb-1.5"
                            resizeMode="cover"
                          />
                          <Text
                            variant="caption1"
                            className="text-center text-muted-foreground"
                            numberOfLines={2}
                          >
                            {item.name}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
