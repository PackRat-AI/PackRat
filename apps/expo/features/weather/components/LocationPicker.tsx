import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { assertNonNull } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { useActiveLocation, useLocations } from '../hooks';
import type { WeatherLocation } from '../types';

type LocationPickerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  selectText?: string;
  onSelect: (location: WeatherLocation) => void;
  skipText?: string;
  onSkip?: () => void;
};

export function LocationPicker({
  open,
  onClose,
  title,
  subtitle,
  onSelect,
  onSkip,
  selectText,
  skipText,
}: LocationPickerProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { locationsState } = useLocations();
  const { activeLocation } = useActiveLocation();
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation | null>(activeLocation);
  
  // Use translations for default values
  const displayTitle = title ?? t('location.selectLocation');
  const displaySelectText = selectText ?? t('common.done');

  // Get the locations array safely
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];
  const hasLocations = locations.length > 0;

  const handleSearchLocation = () => {
    router.push('/weather/search');
  };

  return (
    <>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="px-4 mb-4 py-2 border-b border-border flex-row gap-2 justify-between items-center">
            <View className="flex-row flex-1 items-center gap-2">
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View>
                <Text className="text-lg font-semibold">{displayTitle}</Text>
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
          <ScrollView contentContainerStyle={!hasLocations && { flex: 1 }}>
            {hasLocations ? (
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
                          <Text variant="callout">{t('common.default')}</Text>
                          <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                        </>
                      )}
                      <Text className="text-2xl">{location.temperature}°</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="flex-1 items-center justify-center p-8 gap-4 mt-8">
                <View className="h-16 w-16 rounded-full items-center justify-center bg-neutral-300 dark:bg-neutral-600">
                  <Icon
                    materialIcon={{ name: 'location-searching', type: 'MaterialIcons' }}
                    ios={{ name: 'location' }}
                    size={32}
                    color={colors.grey}
                  />
                </View>
                <View className="items-center gap-1">
                  <Text className="text-base font-semibold">{t('weather.noSavedLocations')}</Text>
                  <Text className="text-xs text-muted-foreground text-center">
                    {t('weather.addLocation')}
                  </Text>
                </View>
                <Button variant="secondary" onPress={handleSearchLocation}>
                  <Text>{t('location.searchButton')}</Text>
                </Button>
              </View>
            )}
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
              <Text>{displaySelectText}</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}
