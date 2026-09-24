import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { capitalizeFirst, surfaceIcon } from '../lib/display';
import { timeAgo } from '../lib/timeAgo';
import type { TrailConditionReport } from '../types';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionDetailProps {
  report: TrailConditionReport;
}

/** `labeledSection` in `TrailConditionDetailView`: a small-caps caption over its content. */
function LabeledSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2 px-4">
      <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * The full report, mirroring `TrailConditionDetailView` in `TrailConditionsView.swift`:
 * condition card in the header, then surface, water crossings, hazards and notes — each section
 * rendered only when the report carries it.
 *
 * The Expo app previously had no detail view at all; every field was crammed into the list card.
 * Splitting them matches iOS and lets the row stay scannable.
 */
export function TrailConditionDetail({ report }: TrailConditionDetailProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const createdAt = report.createdAt ?? report.localCreatedAt;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 py-4 pb-10">
      <View className="flex-row items-start justify-between gap-3 px-4">
        <View className="flex-1 gap-1">
          {report.trailRegion ? (
            <View className="flex-row items-center gap-1">
              <Icon name="map-marker" size={15} color={colors.grey} />
              <Text variant="callout" className="text-muted-foreground">
                {report.trailRegion}
              </Text>
            </View>
          ) : null}
          <Text variant="caption1" className="text-muted-foreground">
            {timeAgo(createdAt)}
          </Text>
        </View>
        <ConditionBadge condition={report.overallCondition} size="lg" />
      </View>

      {report.surface ? (
        <LabeledSection title={t('trailConditions.surface')}>
          <View className="flex-row items-center gap-2">
            <Icon name={surfaceIcon(report.surface)} size={18} color={colors.foreground} />
            <Text variant="callout">{capitalizeFirst(report.surface)}</Text>
          </View>
        </LabeledSection>
      ) : null}

      {report.waterCrossings > 0 ? (
        <LabeledSection title={t('trailConditions.waterCrossings')}>
          <View className="flex-row items-center gap-2">
            <Text variant="callout">{report.waterCrossings}</Text>
            {report.waterCrossingDifficulty ? (
              <Text variant="callout" className="text-muted-foreground">
                · {capitalizeFirst(report.waterCrossingDifficulty)}
              </Text>
            ) : null}
          </View>
        </LabeledSection>
      ) : null}

      {report.hazards.length > 0 ? (
        <LabeledSection title={t('trailConditions.hazards')}>
          <View className="flex-row flex-wrap gap-2">
            {report.hazards.map((hazard) => (
              <View key={hazard} className="rounded-full bg-amber-500/10 px-3 py-1">
                <Text variant="caption1" className="text-amber-600 dark:text-amber-400">
                  {capitalizeFirst(hazard)}
                </Text>
              </View>
            ))}
          </View>
        </LabeledSection>
      ) : null}

      {report.notes ? (
        <LabeledSection title={t('trailConditions.notes')}>
          <View className="rounded-xl bg-card p-4">
            <Text variant="body" wrap>
              {report.notes}
            </Text>
          </View>
        </LabeledSection>
      ) : null}
    </ScrollView>
  );
}
