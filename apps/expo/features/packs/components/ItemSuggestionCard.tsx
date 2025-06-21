import { useState } from "react";
import { Platform, View } from "react-native";
import { Icon } from "@roninoss/icons";
import { useCreatePackItem } from "../hooks";
import { cn } from "~/lib/cn";
import type { CatalogItem } from "~/types";
import { Button } from "nativewindui/Button";
import { useColorScheme } from "~/lib/useColorScheme";
import { Text } from "nativewindui/Text";
import type { PackItemInput } from "../types";
import { nanoid } from "nanoid/non-secure";
import ImageCacheManager from "~/lib/utils/ImageCacheManager";
import { getImageExtension } from "~/lib/utils/imageUtils";
import { ActivityIndicator } from "nativewindui/ActivityIndicator";

interface ItemSuggestionCardProps {
  packId: string;
  item: CatalogItem;
}

export function ItemSuggestionCard({ packId, item }: ItemSuggestionCardProps) {
  const [isAdding, setIsAdding] = useState(false);

  const createItem = useCreatePackItem();
  const { colors } = useColorScheme();

  const handleAddItem = async (item: Omit<CatalogItem, "image"> & { image: string | null }) => {
    setIsAdding(true);
    if (item.image) {
      try {
        const extension = await getImageExtension(item.image);
        const fileName = `${nanoid()}.${extension}`;
        console.log("item.image", item.image);
        await ImageCacheManager.cacheRemoteImage(fileName, item.image);
        item.image = fileName;
      } catch (err) {
        console.log("caching remote image failed", err);
        item.image = null;
      }
    } else {
      item.image = null;
    }
    // Create a new pack item from the catalog item
    const newItem: PackItemInput = {
      name: item.name,
      description: item.description || "",
      weight: item.defaultWeight || 0,
      weightUnit: item.defaultWeightUnit || "oz",
      quantity: 1,
      category: item.category || "Uncategorized",
      consumable: false,
      worn: false,
      image: item.image,
      notes: "Suggested by PackRat AI",
      catalogItemId: item.id,
    };

    createItem({
      packId,
      itemData: newItem,
    });
    setIsAdding(false);
  };

  return (
    <View
      className={cn(
        "mr-2 flex-col justify-between rounded-lg border border-border p-3",
        "w-40 bg-card",
      )}
    >
      <View>
        <Text className="mb-1 font-medium text-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="mb-2 text-xs text-muted-foreground" numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          {item.defaultWeight}
          {item.weightUnit}
        </Text>
        <Button disabled={isAdding} onPress={() => handleAddItem(item)} variant="tonal" size="icon">
          {isAdding ? (
            <ActivityIndicator />
          ) : (
            <Icon
              name="plus"
              color={Platform.OS === "ios" ? colors.primary : colors.foreground}
              size={21}
            />
          )}
        </Button>
      </View>
    </View>
  );
}
