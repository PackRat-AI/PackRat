import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { featureFlags } from 'expo-app/config';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { useTripAnalytics } from '../hooks/useTripAnalytics';

export function TripAnalyticsTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: analytics } = useTripAnalytics();

  const handlePress = () => {
    router.push('/trip-analytics');
  };

  if (!featureFlags.enableTrips) return null;

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-indigo-500">
            <Icon name="chart-bar" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          {analytics !== undefined && (
            <Text variant="footnote" className="text-muted-foreground">
              {analytics.totalTrips} {t('analytics.trips')}
            </Text>
          )}
          <ChevronRight />
        </View>
      }
      item={{
        title: t('analytics.title'),
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
      removeSeparator={Platform.OS === 'ios'}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
