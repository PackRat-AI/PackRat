import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { TouchableOpacity, View, Pressable, Alert, ScrollView } from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from 'nativewindui/Text';
import { Sheet, useSheetRef } from 'nativewindui/Sheet';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import { cn } from 'expo-app/lib/cn';
import { useLocations } from '../hooks';
import { useActiveLocation } from '../hooks';

export function LocationSelector() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const { locationsState } = useLocations();
  const { activeLocation, setActiveLocation } = useActiveLocation();
  const bottomSheetRef = useSheetRef();

  // Get the locations array safely
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];

  // Handle the case when no locations are saved
  if (!activeLocation) {
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

  const handleOpenSheet = () => {
    bottomSheetRef.current?.present();
  };

  const handleSelectLocation = (locationId: string) => {
    setActiveLocation(locationId);
    bottomSheetRef.current?.close();

    // Show confirmation
    const location = locations.find((loc) => loc.id === locationId);
    if (location) {
      Alert.alert(
        'Location Set',
        `${location.name} is now your active location.`,
        [{ text: 'OK' }],
        {
          cancelable: true,
        },
      );
    }
  };

  const handleManageLocations = () => {
    bottomSheetRef.current?.close();
    // Add a small delay to avoid UI conflicts
    setTimeout(() => {
      router.push('/weather');
    }, 300);
  };

  return (
    <>
      <View className="px-4 py-2">
        <TouchableOpacity
          onPress={handleOpenSheet}
          className="bg-muted/30 flex-row items-center gap-2 rounded-full px-3 py-2"
        >
          <Icon name="map-marker-radius-outline" size={16} color={colors.primary} />
          <Text className="flex-1 text-sm font-medium">{activeLocation.name}</Text>
          <Text className="mr-1 text-sm text-muted-foreground">{activeLocation.temperature}°</Text>
          <Icon name="chevron-down" size={16} color={colors.grey2} />
        </TouchableOpacity>
      </View>

      <Sheet
        ref={bottomSheetRef}
        snapPoints={['40%']}
        index={-1}
        enableDynamicSizing={false}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        <BottomSheetScrollView style={{ flex: 1 }}>
          <View className="px-4 pb-4 pt-2">
            <Text className="mb-2 text-lg font-semibold">Select Location</Text>
            <Text className="mb-4 text-xs text-muted-foreground">
              Choose which location to use for weather and AI chat
            </Text>

            <View className="space-y-2">
              {locations.map((location) => (
                <Pressable
                  key={location.id}
                  onPress={() => handleSelectLocation(location.id)}
                  className={cn(
                    'my-2 flex-row items-center rounded-lg p-3',
                    location.id === activeLocation.id ? 'bg-primary/10' : 'bg-muted/50',
                  )}
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : {})}
                >
                  <View
                    className={cn(
                      'mr-3 h-8 w-8 items-center justify-center rounded-full',
                      location.id === activeLocation.id ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <Icon
                      name={
                        location.id === activeLocation.id ? 'check' : 'map-marker-radius-outline'
                      }
                      size={18}
                      color={location.id === activeLocation.id ? 'white' : colors.grey3}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium">{location.name}</Text>
                    <Text className="text-xs dark:text-gray-100/5">{location.condition}</Text>
                  </View>
                  <Text className="text-2xl">{location.temperature}°</Text>
                </Pressable>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleManageLocations}
              className="bg-muted/50 mt-4 flex-row items-center gap-3 rounded-lg p-3"
            >
              <Icon name="cog-outline" size={20} color={colors.foreground} />
              <Text>Manage Locations</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </Sheet>
    </>
  );
}
