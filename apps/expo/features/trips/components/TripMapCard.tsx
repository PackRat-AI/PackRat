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
  /** Sits beside Weather under the map, e.g. the offline map download row. */
  footer?: ReactNode;
};

/** The trip page's map: an interactive preview with Expand and Directions over it, and the place below. */
export function TripMapCard({ location, outdoors, onExpand, onWeather, footer }: TripMapCardProps) {
  const { t } = useTranslation();
  const { title, region } = location.name
    ? splitPlaceName(location.name)
    : {
        title: `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`,
        region: undefined,
      };

  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <View className="h-52">
        <TripMap location={location} outdoors={outdoors} interactive />
        <View
          className="absolute right-3 top-3 overflow-hidden rounded-2xl bg-card"
          style={{ elevation: 3 }}
        >
          <MapControl
            icon="arrow-expand"
            label={t('trips.map.expand')}
            onPress={onExpand}
            testID={testIds.trips.mapPreview}
          />
          <View className="mx-2 h-px bg-border" />
          <MapControl
            icon="directions"
            label={t('trips.map.directions')}
            onPress={() => openDirections(location)}
            testID={testIds.trips.mapDirections}
          />
        </View>
      </View>

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
        <View className="flex-row items-center gap-2">
          {footer ? <View className="flex-1">{footer}</View> : null}
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
    </View>
  );
}

/** A 40dp icon button in the control stack laid over the map. */
function MapControl({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      android_ripple={{ color: colors.grey4 }}
      className="h-11 w-11 items-center justify-center"
    >
      <Icon name={icon} size={22} color={colors.foreground} />
    </Pressable>
  );
}
