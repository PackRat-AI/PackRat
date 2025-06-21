import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "nativewindui/Button";
import { Text } from "nativewindui/Text";
import { Icon } from "@roninoss/icons";
import { useColorScheme } from "~/lib/useColorScheme";

const HEADER_HEIGHT = Platform.select({ ios: 88, default: 64 });

const HEADER_POSITION_STYLE = {
  position: "absolute",
  zIndex: 50,
  top: 0,
  left: 0,
  right: 0,
} as const;

export function AiChatHeader() {
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();

  return Platform.OS === "ios" ? (
    <BlurView intensity={100} style={[HEADER_POSITION_STYLE, { paddingTop: insets.top }]}>
      <View className="flex-row items-center justify-between px-4 pb-2">
        <View className="flex-row items-center">
          <Button variant="plain" size="icon" onPress={router.back}>
            <Icon size={30} color={colors.primary} name="chevron-left" />
          </Button>
        </View>
        <View className="items-center">
          <Text variant="title3" className="text-center">
            PackRat AI
          </Text>
          <Text variant="caption2" className="text-muted-foreground">
            Your Hiking Assistant
          </Text>
        </View>
        <Button variant="plain" size="icon" className="opacity-0">
          <Icon size={28} color={colors.primary} name="pin-outline" />
        </Button>
      </View>
    </BlurView>
  ) : (
    <View
      className="absolute left-0 right-0 top-0 z-50 justify-end bg-card dark:bg-background"
      style={{ paddingTop: insets.top, height: HEADER_HEIGHT + insets.top }}
    >
      <View
        style={{ height: HEADER_HEIGHT }}
        className="flex-row items-center justify-between gap-2 px-3 pb-2"
      >
        <View className="flex-row items-center">
          <Button variant="plain" size="icon" className="opacity-70" onPress={router.back}>
            <Icon
              color={colors.foreground}
              name={Platform.select({
                ios: "chevron-left",
                default: "arrow-left",
              })}
            />
          </Button>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-lg font-medium">PackRat AI</Text>
          <Text variant="caption2" className="text-muted-foreground">
            Your Hiking Assistant
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}
