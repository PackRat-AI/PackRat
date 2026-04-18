import { Text } from '@packrat/ui/nativewindui';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { isArray } from 'radash';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { usePackTemplates } from '../hooks';
import { usePackTemplateSummaries } from '../hooks/usePackTemplateSummary';
import type { PackTemplate, PackTemplateInStore } from '../types';

type FeaturedPackCardProps = {
  template: PackTemplateInStore;
  itemCount: number;
  baseWeight: number;
  totalWeight: number;
  onPress: (template: PackTemplate) => void;
};

function FeaturedPackCard({
  template,
  itemCount,
  baseWeight,
  totalWeight,
  onPress,
}: FeaturedPackCardProps) {
  const { t } = useTranslation();

  const handlePress = () => {
    // The consumer only reads `id` from the template, but we materialise the
    // minimum `PackTemplate` shape to keep the callback type strict.
    onPress({ ...template, items: [], baseWeight, totalWeight });
  };

  return (
    <Pressable
      className="mr-4 w-64 overflow-hidden rounded-xl bg-card shadow-sm"
      onPress={handlePress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {template.image ? (
        <Image source={{ uri: template.image }} className="h-32 w-full" resizeMode="cover" />
      ) : (
        <View className="h-32 w-full items-center justify-center bg-primary/10">
          <Text className="text-4xl">🎒</Text>
        </View>
      )}

      <View className="p-3">
        <Text className="mb-1 text-sm font-semibold text-foreground" numberOfLines={1}>
          {template.name}
        </Text>

        {template.category && (
          <Text className="mb-2 text-xs capitalize text-muted-foreground">{template.category}</Text>
        )}

        {template.tags && isArray(template.tags) && template.tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-2"
            scrollEnabled={false}
          >
            <View className="flex-row flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag) => (
                <View key={tag} className="rounded-full bg-primary/10 px-2 py-0.5">
                  <Text className="text-xs text-primary">{tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-1">
            <WeightBadge weight={baseWeight} unit="g" type="base" />
          </View>
          <Text className="text-xs text-muted-foreground">
            {`${itemCount} ${t('packTemplates.items')}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

type FeaturedPacksSectionProps = {
  onTemplatePress: (template: PackTemplate) => void;
};

export function FeaturedPacksSection({ onTemplatePress }: FeaturedPacksSectionProps) {
  const templates = usePackTemplates();
  const { t } = useTranslation();
  const router = useRouter();

  const featuredTemplates = useMemo(
    () => templates.filter((template) => template.isAppTemplate),
    [templates],
  );

  const featuredIds = useMemo(() => featuredTemplates.map((t) => t.id), [featuredTemplates]);

  // Single pass over the items store computes item count + base weight for all
  // featured templates at once, instead of each card subscribing to the full
  // details hook and iterating every item in the store on its own.
  const summaries = usePackTemplateSummaries(featuredIds);

  if (featuredTemplates.length === 0) return null;

  return (
    <View className="mb-2">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-base font-semibold text-foreground">
          {t('packTemplates.featuredPacks')}
        </Text>
        <Pressable onPress={() => router.push('/pack-templates')}>
          <Text className="text-sm text-primary">{t('packTemplates.viewAll')}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
        className="pb-2"
      >
        {featuredTemplates.map((template) => {
          const summary = summaries[template.id];
          return (
            <FeaturedPackCard
              key={template.id}
              template={template}
              itemCount={summary?.itemCount ?? 0}
              baseWeight={summary?.baseWeight ?? 0}
              totalWeight={summary?.totalWeight ?? 0}
              onPress={onTemplatePress}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
