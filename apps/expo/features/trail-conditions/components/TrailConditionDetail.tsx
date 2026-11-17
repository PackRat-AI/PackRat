import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { buildPostImageUrl } from 'expo-app/features/feed/utils';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { capitalizeFirst, surfaceIcon } from '../lib/display';
import { isPinnedReport, type SignedReport } from '../utils/trails';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionDetailProps {
  report: SignedReport;
  /** The report is still in the outbox. */
  isPending: boolean;
  /** Opens the trail page; absent for a pinned report, which has no trail. */
  onOpenTrail?: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2 px-4">
      <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}

function FactTile({ icon, value, caption }: { icon: string; value: string; caption: string }) {
  const { colors } = useColorScheme();
  return (
    <View className="flex-1 gap-1 rounded-xl bg-card p-3">
      <Icon name={icon} size={18} color={colors.primary} />
      <Text variant="body" className="font-semibold">
        {value}
      </Text>
      <Text variant="caption1" className="text-muted-foreground">
        {caption}
      </Text>
    </View>
  );
}

const PIN_MAP_DELTA = 0.01;

/**
 * The full report, mirroring `TrailConditionDetailView` in `TrailConditionsView.swift`: the
 * condition and who wrote it and when, photos, hazards ("None reported" said outright), what is
 * underfoot, notes, and the place — a link to the trail's page, or a map of the dropped pin.
 */
export function TrailConditionDetail({
  report,
  isPending,
  onOpenTrail,
}: TrailConditionDetailProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const writtenAt = report.localCreatedAt ?? report.createdAt;
  const pinned = isPinnedReport(report);
  const photoWidth = width - 32;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 py-4 pb-10">
      <View className="gap-3 px-4">
        <View className="flex-row items-center justify-between gap-3">
          <ConditionBadge condition={report.overallCondition} size="lg" />
          {isPending ? (
            <View className="flex-row items-center gap-1">
              <Icon name="cloud-upload-outline" size={14} color={colors.grey} />
              <Text variant="caption1" className="text-muted-foreground">
                {t('trailConditions.waitingToSend')}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-start gap-2 rounded-xl border border-border bg-card p-3">
          <Icon name="history" size={16} color={colors.grey} />
          <Text variant="footnote" className="flex-1 text-muted-foreground" wrap>
            {t('trailConditions.writtenAgo', {
              when: getRelativeTime({ dateValue: writtenAt, t }).toLowerCase(),
            })}
          </Text>
        </View>
      </View>

      {report.photos.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-4"
          snapToInterval={photoWidth + 12}
          decelerationRate="fast"
        >
          {report.photos.map((key, index) => (
            <Image
              key={key}
              source={{ uri: buildPostImageUrl(key) }}
              style={{ width: photoWidth, height: photoWidth * 0.75 }}
              className="rounded-xl bg-card"
              resizeMode="cover"
              accessibilityLabel={`${t('trailConditions.photos')} ${index + 1}/${report.photos.length}`}
            />
          ))}
        </ScrollView>
      ) : null}

      <Section title={t('trailConditions.hazards')}>
        {report.hazards.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {report.hazards.map((hazard) => (
              <View key={hazard} className="rounded-full bg-amber-500/10 px-3 py-1">
                <Text variant="caption1" className="text-amber-600 dark:text-amber-400">
                  {capitalizeFirst(hazard)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Icon name="shield-check-outline" size={18} color={colors.green} />
            <Text variant="callout">{t('trailConditions.hazardsNone')}</Text>
          </View>
        )}
      </Section>

      <Section title={t('trailConditions.onTheTrail')}>
        <View className="flex-row gap-3">
          <FactTile
            icon={surfaceIcon(report.surface)}
            value={capitalizeFirst(report.surface)}
            caption={t('trailConditions.surface')}
          />
          <FactTile
            icon="waves"
            value={
              report.waterCrossings > 0
                ? String(report.waterCrossings)
                : t('trailConditions.waterCrossingsNone')
            }
            caption={
              report.waterCrossingDifficulty
                ? `${t('trailConditions.waterCrossings')} · ${capitalizeFirst(report.waterCrossingDifficulty)}`
                : t('trailConditions.waterCrossings')
            }
          />
        </View>
      </Section>

      {report.notes ? (
        <Section
          title={
            report.authorName
              ? t('trailConditions.from', { name: report.authorName })
              : t('trailConditions.notes')
          }
        >
          <View className="rounded-xl bg-card p-4">
            <Text variant="body" wrap>
              {report.notes}
            </Text>
          </View>
        </Section>
      ) : null}

      {onOpenTrail && !pinned ? (
        <View className="px-4">
          <Pressable
            onPress={onOpenTrail}
            testID={testIds.trailConditions.trailPageLink}
            accessibilityRole="link"
            className="flex-row items-center gap-3 rounded-xl bg-card px-4 py-3 active:opacity-80"
          >
            <Icon name="hiking" size={20} color={colors.primary} />
            <View className="flex-1">
              <Text variant="body">{t('trailConditions.allReportsForTrail')}</Text>
              <Text variant="caption1" className="text-muted-foreground" numberOfLines={1}>
                {report.trailName}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.grey} />
          </Pressable>
        </View>
      ) : null}

      {pinned && report.latitude != null && report.longitude != null ? (
        <Section title={t('trailConditions.where')}>
          <View
            className="h-44 overflow-hidden rounded-xl"
            accessible
            accessibilityLabel={t('trailConditions.droppedPin')}
          >
            <MapView
              style={{ flex: 1 }}
              pointerEvents="none"
              initialRegion={{
                latitude: report.latitude,
                longitude: report.longitude,
                latitudeDelta: PIN_MAP_DELTA,
                longitudeDelta: PIN_MAP_DELTA,
              }}
            >
              <Marker
                coordinate={{ latitude: report.latitude, longitude: report.longitude }}
                pinColor={colors.primary}
              />
            </MapView>
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}
