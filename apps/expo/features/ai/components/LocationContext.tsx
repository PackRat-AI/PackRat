import { Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { LocationSelector } from 'expo-app/features/weather/components/LocationSelector';
import { router } from 'expo-router';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import type { WeatherLocation } from '../../weather/types';

interface LocationContextProps {
  location: WeatherLocation | null;
  onSetLocation: (location: WeatherLocation) => void;
}

export function LocationContext({ location, onSetLocation }: LocationContextProps) {
  const { colors } = useColorScheme();
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  if (!location) {
    return (
      <View className="px-4 py-2">
        <TouchableOpacity
          onPress={() => router.push('/weather')}
          className="bg-muted/30 flex-row items-center gap-2 rounded-full px-3 py-2"
        >
          <Icon name="map-marker-radius-outline" size={16} color={colors.primary} />
          <Text className="flex-1 text-sm font-medium">Add a location</Text>
          <Icon name="chevron-right" size={16} color={colors.grey2} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View className="px-4 py-2">
        <TouchableOpacity
          onPress={() => setShowLocationSelector(true)}
          className="bg-muted/30 flex-row items-center gap-2 rounded-full px-3 py-2"
        >
          <Icon name="map-marker-radius-outline" size={16} color={colors.primary} />
          <Text className="flex-1 text-sm font-medium">{location.name}</Text>
          <Text className="mr-1 text-sm text-muted-foreground">{location.temperature}°</Text>
          <Icon name="chevron-down" size={16} color={colors.grey2} />
        </TouchableOpacity>
      </View>
      <LocationSelector
        open={showLocationSelector}
        onClose={() => setShowLocationSelector(false)}
        subtitle="Choose location for AI context"
        onSelect={onSetLocation}
      />
    </>
  );
}
