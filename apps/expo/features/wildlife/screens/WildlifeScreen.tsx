import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, View } from 'react-native';
import { useWildlifeHistory } from '../hooks/useWildlifeHistory';
import type { WildlifeIdentification } from '../types';

function HistoryItem({ item, onPress }: { item: WildlifeIdentification; onPress: () => void }) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const topResult = item.results[0];
  const date = new Date(item.timestamp).toLocaleDateString();

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-3 bg-card border border-border rounded-xl p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          {topResult ? (
            <>
              <Text className="text-base font-semibold text-foreground">
                {topResult.species.commonName}
              </Text>
              <Text className="text-sm italic text-muted-foreground">
                {topResult.species.scientificName}
              </Text>
            </>
          ) : (
            <Text className="text-base text-muted-foreground">{t('wildlife.unknownSpecies')}</Text>
          )}
          <Text className="text-xs text-muted-foreground mt-1">{date}</Text>
        </View>
        <Icon name="chevron-right" size={17} color={colors.grey} />
      </View>
    </Pressable>
  );
}

export function WildlifeScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { historyState } = useWildlifeHistory();

  const history = historyState.state === 'hasData' ? historyState.data : [];
  const isLoading = historyState.state === 'loading';

  const handleIdentify = () => {
    router.push('/wildlife/identify');
  };

  const handleHistoryItemPress = (item: WildlifeIdentification) => {
    router.push({
      pathname: '/wildlife/[id]',
      params: { id: item.id },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <LargeTitleHeader title={t('wildlife.wildlife')} backVisible={false} />

      {/* Identify FAB */}
      <View className="px-4 mb-4">
        <Pressable
          onPress={handleIdentify}
          className="flex-row items-center justify-center gap-3 bg-primary rounded-xl py-4 px-6"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Icon name="camera-outline" size={24} color="#ffffff" />
          <Text className="text-white text-base font-semibold">
            {t('wildlife.identifySpecies')}
          </Text>
        </Pressable>
      </View>

      {/* History Section */}
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : history.length > 0 ? (
          <>
            <Text className="px-4 pb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('wildlife.recentIdentifications')}
            </Text>
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <HistoryItem item={item} onPress={() => handleHistoryItemPress(item)} />
              )}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <View className="bg-primary/10 rounded-full p-6 mb-4">
              <Icon name="leaf" size={48} color={colors.primary} />
            </View>
            <Text className="text-xl font-semibold text-center mb-2">
              {t('wildlife.noIdentifications')}
            </Text>
            <Text className="text-center text-muted-foreground text-base">
              {t('wildlife.noIdentificationsDescription')}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
