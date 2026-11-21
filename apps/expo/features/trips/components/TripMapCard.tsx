import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { type Coords, openDirections, splitPlaceName } from '../lib/places';
import { TripMap } from './TripMap';

type TripMapCardProps = {
  location: Coords & { name?: string };
  outdoors: boolean;
  onExpand: () => void;
  onWeather: () => void;
  /** Extra rows under the actions, e.g. the offline map download row. */
  footer?: ReactNode;
};

/** The trip page's map: a still preview that opens the full-screen map, with the place below. */
export function TripMapCard({ location, outdoors, onExpand, onWeather, footer }: TripMapCardProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { title, region } = location.name
    ? splitPlaceName(location.name)
    : {
        title: `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`,
        region: undefined,
      };

  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={t('trips.map.expand')}
        testID={testIds.trips.mapPreview}
        className="h-48"
      >
        <TripMap location={location} outdoors={outdoors} />
        <View
          pointerEvents="none"
          className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-card"
          style={{ elevation: 3 }}
        >
          <Icon name="arrow-expand" size={20} color={colors.foreground} />
        </View>
      </Pressable>

      <View className="gap-3 p-4">
        <View>
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
          {region ? (
            <Text variant="subhead" className="text-muted-foreground" numberOfLines={1}>
              {region}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          <Button
            variant="tonal"
            icon="directions"
            onPress={() => openDirections(location)}
            testID={testIds.trips.mapDirections}
          >
            <Text>{t('trips.map.directions')}</Text>
          </Button>
          <Button
            variant="outlined"
            icon="weather-partly-cloudy"
            onPress={onWeather}
            testID={testIds.trips.mapWeather}
          >
            <Text>{t('trips.map.weather')}</Text>
          </Button>
        </View>
      </View>

      {footer ? <View className="border-t border-border p-3">{footer}</View> : null}
    </View>
  );
}
