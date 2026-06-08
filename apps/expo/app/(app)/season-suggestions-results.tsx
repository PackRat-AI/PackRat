import { LargeTitleHeader, Text, useColorScheme } from '@packrat/ui/nativewindui';
import * as Burnt from 'burnt';
import { Icon } from 'expo-app/components/Icon';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { PackItemImage } from 'expo-app/features/packs/components/PackItemImage';
import { useCreatePackWithItems } from 'expo-app/features/packs/hooks/useCreatePackWithItems';
import {
  type PackSuggestion,
  useSeasonSuggestions,
} from 'expo-app/features/packs/hooks/useSeasonSuggestions';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

function ShimmerBar() {
  const { width } = useWindowDimensions();
  const { colors } = useColorScheme();
  const translateX = useSharedValue(-200);

  useEffect(() => {
    translateX.value = withRepeat(withTiming(width, { duration: 900, easing: Easing.linear }), -1);
  }, [translateX, width]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    backgroundColor: colors.primary,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 200 }, animStyle]} />
  );
}

export default function SeasonSuggestionsResultsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { location, date } = useLocalSearchParams<{ location: string; date: string }>();
  const seasonSuggestions = useSeasonSuggestions();
  const createPackWithItems = useCreatePackWithItems();
  const [creatingPackIndex, setCreatingPackIndex] = useState<number | null>(null);
  const [createdPacks, setCreatedPacks] = useState<Record<number, string>>({});
  const { colors } = useColorScheme();
  const user = useUser();
  const triggered = useRef(false);

  useEffect(() => {
    if (!triggered.current && location && date) {
      triggered.current = true;
      seasonSuggestions.mutate({ location, date });
    }
    // runs once on mount — location/date are stable URL params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePack = ({
    suggestion,
    index,
  }: {
    suggestion: PackSuggestion;
    index: number;
  }) => {
    setCreatingPackIndex(index);
    setTimeout(() => {
      const packId = createPackWithItems(suggestion);
      setCreatingPackIndex(null);
      setCreatedPacks((prev) => ({ ...prev, [index]: packId }));
      Burnt.toast({ title: t('seasons.packCreated'), preset: 'done' });
    }, 500);
  };

  const { data, isPending, error } = seasonSuggestions;

  return (
    <>
      <LargeTitleHeader title={t('seasons.seasonSuggestions')} />

      {isPending && (
        <View className="h-0.5 w-full overflow-hidden bg-muted">
          <ShimmerBar />
        </View>
      )}

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 px-4">
        <View className="py-6">
          {error && (
            <View className="rounded-xl border border-red-200 bg-red-50 p-4">
              <Text variant="callout" className="font-medium text-red-800">
                {t('errors.error')}
              </Text>
              <Text variant="body" className="text-red-700">
                {error.message}
              </Text>
            </View>
          )}

          {data && (
            <View>
              <View className="flex-row items-center gap-2 mb-8">
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
                    name="mappin"
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
                        disabled={creatingPackIndex === index}
                      >
                        {creatingPackIndex === index ? (
                          <ActivityIndicator size="small" />
                        ) : createdPacks[index] ? (
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
                              // packItems.userId is text in the DB; PackItem.userId?: number is a stale type
                              userId: user?.id as unknown as number,
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
