import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWildlifeHistory } from '../hooks/useWildlifeHistory';
import type { SpeciesIdentification } from '../types';

function HistoryCard({ entry }: { entry: SpeciesIdentification }) {
  const pct = Math.round(entry.confidence * 100);
  const formattedDate = new Date(entry.identifiedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View className="mb-3 flex-row overflow-hidden rounded-2xl bg-card">
      {entry.imageUri ? (
        <Image
          source={{ uri: entry.imageUri }}
          style={{ width: 80, height: 80 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-20 w-20 items-center justify-center bg-muted">
          <Icon name="image-outline" size={32} color="#9ca3af" />
        </View>
      )}
      <View className="flex-1 px-3 py-3">
        <View className="mb-1 flex-row items-center justify-between">
          <Text variant="headline" className="flex-1 font-semibold" numberOfLines={1}>
            {entry.name}
          </Text>
          <View className="rounded-full bg-primary/10 px-2 py-0.5">
            <Text variant="caption2" className="font-medium text-primary">
              {pct}%
            </Text>
          </View>
        </View>
        <Text variant="caption1" className="mb-1 italic text-muted-foreground">
          {entry.scientificName}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon name="calendar-outline" size={12} color="#9ca3af" />
          <Text variant="caption2" className="text-muted-foreground">
            {formattedDate}
          </Text>
          <Text variant="caption2" className="ml-2 capitalize text-muted-foreground">
            · {entry.category}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function WildlifeHistoryScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { history, isLoading, clear } = useWildlifeHistory();

  const handleClear = () => {
    Alert.alert(t('wildlife.clearHistory'), t('wildlife.clearHistoryConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: clear,
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <LargeTitleHeader
        title={t('wildlife.identificationHistory')}
        rightView={
          history.length > 0
            ? () => (
                <Pressable className="px-2 opacity-80" onPress={handleClear}>
                  {({ pressed }) => (
                    <View className={pressed ? 'opacity-50' : 'opacity-90'}>
                      <Icon name="trash-can-outline" size={22} color={colors.destructive} />
                    </View>
                  )}
                </Pressable>
              )
            : undefined
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {isLoading && (
          <View className="items-center justify-center py-16">
            <Text variant="body" className="text-muted-foreground">
              {t('common.loading')}
            </Text>
          </View>
        )}

        {!isLoading && history.length === 0 && (
          <View className="items-center justify-center py-16">
            <Icon name="leaf-circle-outline" size={64} color="#9ca3af" />
            <Text variant="title3" className="mt-4 font-semibold text-muted-foreground">
              {t('wildlife.noHistoryTitle')}
            </Text>
            <Text variant="body" className="mt-2 text-center text-muted-foreground">
              {t('wildlife.noHistoryDescription')}
            </Text>
          </View>
        )}

        {!isLoading && history.map((entry) => <HistoryCard key={entry.id} entry={entry} />)}
      </ScrollView>
    </View>
  );
}
