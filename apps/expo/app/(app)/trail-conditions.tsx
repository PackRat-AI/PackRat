import { ActivityIndicator, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { featureFlags } from 'expo-app/config';
import { SubmitConditionReportForm } from 'expo-app/features/trail-conditions/components/SubmitConditionReportForm';
import { TrailConditionReportCard } from 'expo-app/features/trail-conditions/components/TrailConditionReportCard';
import { useTrailConditionReports } from 'expo-app/features/trail-conditions/hooks/useTrailConditionReports';
import type { TrailConditionReport, TrailSurface } from 'expo-app/features/trail-conditions/types';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type SurfaceFilter = TrailSurface | 'all';

interface FilterItem {
  value: SurfaceFilter;
  label: string;
}

function getSurfaceBadgeColor(surface: TrailSurface): string {
  switch (surface) {
    case 'paved':
      return 'bg-blue-500';
    case 'gravel':
      return 'bg-amber-500';
    case 'dirt':
      return 'bg-yellow-700';
    case 'rocky':
      return 'bg-gray-500';
    case 'snow':
      return 'bg-sky-300';
    case 'mud':
      return 'bg-stone-600';
    default:
      return 'bg-gray-400';
  }
}

export default function TrailConditionsScreen() {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedSurface, setSelectedSurface] = useState<SurfaceFilter>('all');
  const { data: reports, isLoading, error } = useTrailConditionReports();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const SURFACE_FILTERS: FilterItem[] = useMemo(
    () => [
      { value: 'all', label: t('trailConditions.filters.all') },
      { value: 'paved', label: t('trailConditions.filters.paved') },
      { value: 'gravel', label: t('trailConditions.filters.gravel') },
      { value: 'dirt', label: t('trailConditions.filters.dirt') },
      { value: 'rocky', label: t('trailConditions.filters.rocky') },
      { value: 'snow', label: t('trailConditions.filters.snow') },
      { value: 'mud', label: t('trailConditions.filters.mud') },
    ],
    [t],
  );

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (selectedSurface === 'all') return reports;
    return reports.filter((r) => r.surface === selectedSurface);
  }, [reports, selectedSurface]);

  if (!featureFlags.enableTrailConditions) return null;

  const filterBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 px-4 py-3"
    >
      {SURFACE_FILTERS.map((filter) => {
        const isSelected = selectedSurface === filter.value;
        const colorClass =
          filter.value !== 'all' && isSelected
            ? getSurfaceBadgeColor(filter.value)
            : isSelected
              ? 'bg-primary'
              : 'bg-card';
        return (
          <Pressable
            key={filter.value}
            onPress={() => setSelectedSurface(filter.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={filter.label}
            className={`rounded-full border px-3 py-1.5 ${
              isSelected ? 'border-transparent' : 'border-border'
            } ${colorClass}`}
          >
            <Text
              variant="footnote"
              className={isSelected ? 'font-semibold text-white' : 'text-foreground'}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const listHeader = (
    <>
      <View className="p-4 pb-0">
        <Text variant="subhead" className="mb-2 text-muted-foreground">
          {t('trailConditions.subtitle')}
        </Text>
      </View>
      {filterBar}
    </>
  );

  const listFooter = (
    <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
      <View className="rounded-md bg-muted p-3 dark:bg-gray-50/10">
        <Text variant="footnote" className="text-muted-foreground">
          {t('trailConditions.disclaimer')}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: TrailConditionReport }) => (
    <TrailConditionReportCard report={item} />
  );

  const listEmptyComponent = isLoading ? (
    <View className="flex-1 items-center justify-center py-12">
      <ActivityIndicator />
    </View>
  ) : error ? (
    <View className="mx-4 mb-3 rounded-xl bg-card p-4">
      <Text variant="body" className="text-center text-muted-foreground">
        {t('trailConditions.loadError')}
      </Text>
    </View>
  ) : selectedSurface !== 'all' ? (
    <View className="mx-4 mb-3 rounded-xl bg-card p-8">
      <Text variant="body" className="text-center text-muted-foreground">
        {t('trailConditions.noResults')}
      </Text>
    </View>
  ) : (
    <View className="mx-4 mb-3 rounded-xl bg-card p-8">
      <Text variant="body" className="text-center text-muted-foreground">
        {t('trailConditions.noReports')}
      </Text>
      <Pressable
        onPress={() => setShowSubmitForm(true)}
        className="mt-4 rounded-lg bg-primary px-4 py-3"
        accessibilityLabel={t('trailConditions.submitReport')}
        accessibilityRole="button"
      >
        <Text className="text-center font-semibold text-primary-foreground">
          {t('trailConditions.submitReport')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top }}>
      <LargeTitleHeader
        title={t('trailConditions.title')}
        rightView={() => (
          <Pressable
            onPress={() => setShowSubmitForm(true)}
            className="mr-2 rounded-full bg-primary px-3 py-1.5"
            accessibilityLabel={t('trailConditions.reportConditionsTitle')}
            accessibilityRole="button"
          >
            <Text variant="footnote" className="font-semibold text-primary-foreground">
              {t('trailConditions.reportButton')}
            </Text>
          </Pressable>
        )}
      />

      <FlatList<TrailConditionReport>
        className="flex-1"
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmptyComponent}
        contentContainerClassName="pb-4"
      />

      {/* Submit Report Modal */}
      <Modal
        visible={showSubmitForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSubmitForm(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text variant="heading" className="font-semibold">
              {t('trailConditions.reportConditionsTitle')}
            </Text>
            <Pressable
              onPress={() => setShowSubmitForm(false)}
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
            >
              <Text className="font-semibold text-primary">{t('common.cancel')}</Text>
            </Pressable>
          </View>
          <SubmitConditionReportForm onSuccess={() => setShowSubmitForm(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
