import { useActionSheet } from "@expo/react-native-action-sheet";
import { Text } from "expo-app/components/nativewindui/Text";
import { cn } from "expo-app/lib/cn";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import { Pressable, View } from "react-native";
import type { WeatherLocation } from "../types";

interface LocationCardProps {
  location: WeatherLocation;
  onPress: () => void;
  onSetActive: () => void;
  onRemove: () => void;
}

export function LocationCard({
  location,
  onPress,
  onSetActive,
  onRemove,
}: LocationCardProps) {
  const { colors, colorScheme } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();

  const handleLongPress = () => {
    const options = location.isActive
      ? ["View Details", "Remove", "Cancel"]
      : ["View Details", "Set as Active", "Remove", "Cancel"];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf("Remove");
    const viewDetailsIndex = 0;
    const setActiveIndex = options.indexOf("Set as Active");

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: location.name,
        message: `${location.temperature}° - ${location.condition}`,
        containerStyle: {
          backgroundColor: colorScheme === "dark" ? colors.card : "white",
        },
        textStyle: {
          color: colors.foreground,
        },
        titleTextStyle: {
          color: colors.foreground,
          fontWeight: "600",
        },
        messageTextStyle: {
          color: colors.grey2,
        },
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case viewDetailsIndex:
            onPress();
            break;
          case setActiveIndex:
            onSetActive();
            break;
          case destructiveButtonIndex:
            onRemove();
            break;
          case cancelButtonIndex:
            // Canceled
            break;
        }
      }
    );
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      {({ pressed }) => (
        <View
          className={cn(
            "border-border/10 mb-4 overflow-hidden rounded-2xl border",
            pressed ? "opacity-80" : "opacity-100"
          )}
          style={{ backgroundColor: getCardColor(location, colors) }}
        >
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-lg font-semibold text-white">
                  {location.name}
                </Text>
                {location.isActive && (
                  <View className="ml-2 rounded-full bg-white/30 px-2 py-0.5">
                    <Text className="text-xs text-white">Active</Text>
                  </View>
                )}
              </View>
              <Text className="text-xs text-white opacity-80">
                {location.time}
              </Text>
              <Text
                className="mt-1 text-sm text-white opacity-90"
                numberOfLines={1}
              >
                {location.condition}
              </Text>
              {location.alerts && (
                <View className="mt-1 self-start rounded-md bg-white/20 px-2 py-0.5">
                  <Text className="text-xs text-white">{location.alerts}</Text>
                </View>
              )}
            </View>
            <View className="items-end">
              <Text className="text-4xl text-white">
                {location.temperature}°
              </Text>
              <Text className="mt-1 text-xs text-white">
                H:{location.highTemp}° L:{location.lowTemp}°
              </Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function getCardColor(location: WeatherLocation, colors: any) {
  // Color based on condition and time
  const conditions: Record<string, string> = {
    clear: "#4287f5",
    sunny: "#4287f5",
    cloud: "#7a7a7a",
    rain: "#5d6273",
    snow: "#a3b8cc",
    thunder: "#525580",
    storm: "#525580",
    wind: "#5d8aa8",
    fog: "#7a7a7a",
    mist: "#7a7a7a",
    haze: "#7a7a7a",
  };

  // Extract base condition from the full condition text
  const conditionLower = location.condition.toLowerCase();
  let baseColor = "#4287f5"; // Default blue

  for (const [key, color] of Object.entries(conditions)) {
    if (conditionLower.includes(key)) {
      baseColor = color;
      break;
    }
  }

  return baseColor;
}
