import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { Pack } from 'expo-app/features/packs';
import { useRecentPacks } from 'expo-app/features/packs/hooks/useRecentPacks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import { Image, ScrollView, View } from 'react-native';

function RecentPackCard({ pack }: { pack: Pack }) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      {pack.image && (
        <Image source={{ uri: pack.image }} className="h-40 w-full bg-red-950" resizeMode="cover" />
      )}
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text variant="heading" className="font-semibold">
              {pack.name}
            </Text>
            {pack.description && (
              <Text variant="subhead" className="text-muted-foreground">
                {pack.description}
              </Text>
            )}
          </View>
          <View className="items-end">
            <Text variant="subhead" className="font-medium">
              {pack.totalWeight ?? 0} g
            </Text>
            <Text variant="footnote" className="text-muted-foreground">
              {getRelativeTime(pack.localCreatedAt)}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center">
          <View className="mr-1">
            <Icon name="clock-outline" size={14} color={colors.grey} />
          </View>
          <Text variant="caption1" className="text-muted-foreground">
            {t('packs.lastUpdated', { time: getRelativeTime(pack.localUpdatedAt) })}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function RecentPacksScreen() {
  const recentPacks = useRecentPacks();
  const { t } = useTranslation();

  return (
    <View className="flex-1">
      <LargeTitleHeader title={t('packs.recentPacks')} />
      {recentPacks.length ? (
        <ScrollView className="flex-1">
          <View className="p-4">
            <Text variant="subhead" className="mb-2 text-muted-foreground">
              {t('packs.recentlyUpdated')}
            </Text>
          </View>

          <View className="pb-4">
            {recentPacks.map((pack) => (
              <RecentPackCard key={pack.id} pack={pack} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text variant="body" className="mb-2 text-muted-foreground">
            {t('packs.noRecentPacks')}
          </Text>
        </View>
      )}
    </View>
  );
}
