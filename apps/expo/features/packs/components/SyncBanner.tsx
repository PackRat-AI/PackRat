import { Icon } from "@roninoss/icons";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function SyncBanner() {
  const router = useRouter();
  const { colors } = useColorScheme();

  const handlePress = () =>
    router.push({ pathname: "/auth", params: { redirectTo: "/packs" } });

  return (
    <Pressable
      onPress={handlePress}
      className="mx-4 my-2 flex-row items-center justify-between rounded-xl bg-blue-50 p-3"
    >
      <View className="flex-row items-center gap-2">
        <Icon name="cloud-outline" size={20} color={colors.primary} />
        <Text className="font-medium text-blue-800">
          Sync your packs across devices
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.primary} />
    </Pressable>
  );
}
