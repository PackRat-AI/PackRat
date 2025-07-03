import { Icon } from "@roninoss/icons";
import { CategoryBadge } from "expo-app/components/initial/CategoryBadge";
import { WeightBadge } from "expo-app/components/initial/WeightBadge";
import { Alert } from "expo-app/components/nativewindui/Alert";
import { Button } from "expo-app/components/nativewindui/Button";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import { isArray } from "radash";
import { Image, Pressable, Text, View } from "react-native";
import { useDeletePack, usePackDetailsFromStore } from "../hooks";
import { usePackOwnershipCheck } from "../hooks/usePackOwnershipCheck";
import type { Pack, PackInStore } from "../types";

type PackCardProps = {
  pack: Pack | PackInStore;
  onPress: (pack: Pack) => void;
};

export function PackCard({ pack: packArg, onPress }: PackCardProps) {
  const deletePack = useDeletePack();
  const { colors } = useColorScheme();
  const isOwnedByUser = usePackOwnershipCheck(packArg.id);
  const packFromStore = usePackDetailsFromStore(packArg.id); // Use pack from store if it's owned by the current user so that component observe changes to it and thus update properly.
  const pack = (isOwnedByUser ? packFromStore : packArg) as Pack; // Use passed pack for non user owned pack.

  const hasBaseWeight =
    typeof pack.baseWeight === "number" && pack.baseWeight > 0;
  const hasTotalWeight =
    typeof pack.totalWeight === "number" && pack.totalWeight > 0;

  return (
    <Pressable
      className="mb-4 overflow-hidden rounded-xl bg-card shadow-sm"
      onPress={() => onPress(pack)}
    >
      {pack.image && (
        <Image
          source={{ uri: pack.image }}
          className="h-40 w-full"
          resizeMode="cover"
        />
      )}
      <View className="p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">
            {pack.name}
          </Text>
          {pack.category && <CategoryBadge category={pack.category} />}
        </View>

        {pack.description && (
          <Text className="mb-3 text-foreground" numberOfLines={2}>
            {pack.description}
          </Text>
        )}

        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-2">
            {hasBaseWeight ? (
              <WeightBadge weight={pack.baseWeight ?? 0} unit="g" type="base" />
            ) : null}
            {hasTotalWeight ? (
              <WeightBadge
                weight={pack.totalWeight ?? 0}
                unit="g"
                type="total"
              />
            ) : null}
          </View>
          {pack.items && isArray(pack.items) && pack.items.length > 0 ? (
            <Text className="text-xs text-foreground">
              {pack.items.length} items
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-baseline justify-between">
          {pack.tags && isArray(pack.tags) && pack.tags.length > 0 ? (
            <View className="mt-3 flex-row flex-wrap">
              {pack.tags.map((tag, index) => (
                <View
                  key={index}
                  className="mb-1 mr-2 rounded-full bg-background px-2 py-1"
                >
                  <Text className="text-xs text-foreground">#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {isOwnedByUser && (
            <View className="ml-auto">
              <Alert
                title="Delete pack?"
                message="Are you sure you want to delete this pack? This action cannot be undone."
                buttons={[
                  { text: "Cancel", style: "cancel" },
                  { text: "OK", onPress: () => deletePack(pack.id) },
                ]}
              >
                <Button variant="plain" size="icon">
                  <Icon name="trash-can" size={21} color={colors.grey2} />
                </Button>
              </Alert>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
