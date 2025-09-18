import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertNonNull } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { useActiveLocation, useLocations } from '../hooks';
import type { WeatherLocation } from '../types';

type LocationSelectorProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  selectText?: string;
  onSelect: (location: WeatherLocation) => void;
  skipText?: string;
  onSkip?: () => void;
};

export function LocationSelector({
  open,
  onClose,
  title = 'Select Location',
  subtitle,
  onSelect,
  onSkip,
  selectText = 'Done',
  skipText,
}: LocationSelectorProps) {
  const { colors } = useColorScheme();
  const router = useRouter();
  const { locationsState } = useLocations();
  const { activeLocation } = useActiveLocation();
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation | null>(activeLocation);

  // Get the locations array safely
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];

  const handleSearchLocation = () => {
    router.push('/weather/search');
  };

  return (
    <>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="px-4 mb-4 py-2 border-b border-border flex-row gap-2 justify-between items-center">
            <View className="flex-row items-center gap-2">
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View>
                <Text className="text-lg font-semibold">{title}</Text>
                {subtitle && <Text className="text-xs text-muted-foreground">{subtitle}</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={handleSearchLocation}>
              {/* <Icon name="cog-outline" size={20} color={colors.foreground} /> */}
              <Icon
                materialIcon={{ name: 'search', type: 'MaterialIcons' }}
                ios={{ name: 'magnifyingglass' }}
                size={20}
                color={colors.foreground}
              />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <View className="gap-2 p-4">
              {locations.map((location) => (
                <Pressable
                  key={location.id}
                  onPress={() => setSelectedLocation(location)}
                  className={cn(
                    'flex-row items-center rounded-lg p-2 border border-border bg-card',
                    location.id === selectedLocation?.id && 'border-primary',
                  )}
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : {})}
                >
                  <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-neutral-300 dark:bg-neutral-600">
                    <Icon name="map-marker-radius-outline" size={18} color={colors.grey} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium">{location.name}</Text>
                    <Text className="text-xs text-muted-foreground">{location.condition}</Text>
                  </View>
                  <View className="flex-row gap-2 items-center">
                    {location.id === activeLocation?.id && (
                      <>
                        <Text variant="callout">Default</Text>
                        <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                      </>
                    )}
                    <Text className="text-2xl">{location.temperature}°</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View className="px-4 pb-2 flex-row self-end items-center gap-2 justify-between">
            {onSkip && (
              <Button
                onPress={() => {
                  onClose();
                  onSkip();
                }}
                variant="secondary"
              >
                <Text>{skipText}</Text>
              </Button>
            )}
            <Button
              onPress={() => {
                onClose();
                assertNonNull(selectedLocation);
                onSelect(selectedLocation);
              }}
              disabled={!selectedLocation}
              variant="tonal"
            >
              <Text>{selectText}</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}
