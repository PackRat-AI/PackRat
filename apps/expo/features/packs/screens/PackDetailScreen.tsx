import { Icon } from "@roninoss/icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, SafeAreaView, ScrollView, TouchableOpacity, View } from "react-native";

import { useDeletePack, usePackDetails } from "../hooks";

import { CategoryBadge } from "~/components/initial/CategoryBadge";
import { Chip } from "~/components/initial/Chip";
import { WeightBadge } from "~/components/initial/WeightBadge";
import { Alert } from "nativewindui/Alert";
import { Button } from "nativewindui/Button";
import { Text } from "nativewindui/Text";
import { isAuthed } from "~/features/auth/store";
import { PackItemCard } from "~/features/packs/components/PackItemCard";
import { PackItemSuggestions } from "~/features/packs/components/PackItemSuggestions";
import { cn } from "~/lib/cn";
import { useColorScheme } from "~/lib/useColorScheme";
import { NotFoundScreen } from "~/screens/NotFoundScreen";
import type { PackItem } from "~/types";

export function PackDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState("all");

  const pack = usePackDetails(id as string);
  useFocusEffect(
    useCallback(() => {
      pack.refetch?.();
    }, [pack]),
  );
  const deletePack = useDeletePack();
  const { colors } = useColorScheme();

  const handleItemPress = (item: PackItem) => {
    if (!item.id) return;
    router.push({
      pathname: `/item/[id]`,
      params: { id: item.id, packId: item.packId },
    });
  };

  const getFilteredItems = () => {
    if (!pack?.items) return [];

    switch (activeTab) {
      case "worn":
        return pack.items.filter((item) => item.worn);
      case "consumable":
        return pack.items.filter((item) => item.consumable);
      case "all":
      default:
        return pack.items;
    }
  };

  const filteredItems = getFilteredItems();

  const getTabStyle = (tab: string) => {
    return cn("flex-1 items-center py-4", activeTab === tab ? "border-b-2 border-primary" : "");
  };

  const getTabTextStyle = (tab: string) => {
    return cn(activeTab === tab ? "text-primary" : "text-muted-foreground");
  };

  if (!pack) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <NotFoundScreen title="Pack not found" message="Please try again later." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        {pack.image && (
          <Image source={{ uri: pack.image }} className="h-48 w-full" resizeMode="cover" />
        )}

        <View className="mb-4 bg-card p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">{pack.name}</Text>
            <CategoryBadge category={pack.category} />
          </View>

          {pack.description && (
            <Text className="mb-4 text-muted-foreground">{pack.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">BASE WEIGHT</Text>
              <WeightBadge weight={pack.baseWeight || 0} unit="g" type="base" />
            </View>

            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">TOTAL WEIGHT</Text>
              <WeightBadge weight={pack.totalWeight || 0} unit="g" type="total" />
            </View>

            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">ITEMS</Text>
              <Chip textClassName="text-center text-xs" variant="secondary">
                {pack.items?.length || 0}
              </Chip>
            </View>
          </View>

          <View className="flex-row justify-between">
            {pack.tags && pack.tags.length > 0 && (
              <View className="flex-row flex-wrap">
                {pack.tags.map((tag, index) => (
                  <Chip
                    key={index}
                    className="mb-1 mr-2"
                    textClassName="text-xs text-center"
                    variant="outline"
                  >
                    #{tag}
                  </Chip>
                ))}
              </View>
            )}
            <Alert
              title="Delete pack?"
              message="Are you sure you want to delete this pack? This action cannot be undone."
              buttons={[
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "OK",
                  onPress: () => {
                    deletePack(pack.id);
                    if (router.canGoBack()) {
                      router.back();
                    }
                  },
                },
              ]}
            >
              <Button variant="plain" size="icon">
                <Icon name="trash-can" color={colors.grey2} size={21} />
              </Button>
            </Alert>
          </View>
        </View>

        <View className="bg-card">
          <View className="p-4">
            <Button
              variant="secondary"
              onPress={() => {
                if (!isAuthed.peek()) {
                  return router.push({
                    pathname: "/auth",
                    params: {
                      redirectTo: JSON.stringify({
                        pathname: "/ai-chat",
                        params: {
                          packId: id,
                          packName: pack.name,
                          contextType: "pack",
                        },
                      }),
                      showSignInCopy: "true",
                    },
                  });
                }

                router.push({
                  pathname: "/ai-chat",
                  params: {
                    packId: id,
                    packName: pack.name,
                    contextType: "pack",
                  },
                });
              }}
            >
              <Icon name="message-outline" color={colors.foreground} />
              <Text>Ask AI</Text>
            </Button>
          </View>

          <View className="flex-row border-b border-border">
            <TouchableOpacity className={getTabStyle("all")} onPress={() => setActiveTab("all")}>
              <Text className={getTabTextStyle("all")}>All Items</Text>
            </TouchableOpacity>

            <TouchableOpacity className={getTabStyle("worn")} onPress={() => setActiveTab("worn")}>
              <Text className={getTabTextStyle("worn")}>Worn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={getTabStyle("consumable")}
              onPress={() => setActiveTab("consumable")}
            >
              <Text className={getTabTextStyle("consumable")}>Consumable</Text>
            </TouchableOpacity>
          </View>
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <View key={index} className="px-4 pt-3">
                <PackItemCard item={item} onPress={handleItemPress} />
              </View>
            ))
          ) : (
            <View className="items-center justify-center p-4">
              <Text className="text-muted-foreground">No items found</Text>
            </View>
          )}

          {/* AI Suggestions Section */}
          {!!filteredItems.length && (
            <PackItemSuggestions
              packId={pack.id}
              userId={pack.userId}
              packItems={pack.items || []}
              // onItemAdded={refetch}
            />
          )}

          <Button
            className="m-4"
            onPress={() =>
              router.push({
                pathname: "/item/new",
                params: { packId: pack.id },
              })
            }
          >
            <Text>Add New Item</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
