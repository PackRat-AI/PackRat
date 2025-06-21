import { Icon } from "@roninoss/icons";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { searchValueAtom } from "~/atoms/itemListAtoms";
import { CatalogItemCard } from "~/features/catalog/components/CatalogItemCard";
import { useHeaderSearchBar } from "~/lib/useHeaderSearchBar";
import { useCatalogItems } from "../hooks";
import type { CatalogItem } from "../types";
import { LargeTitleHeader } from "nativewindui/LargeTitleHeader";
import { Text } from "nativewindui/Text";
import { withAuthWall } from "~/features/auth/hocs";
import { CatalogItemsAuthWall } from "../components";

type FilterOption = {
  label: string;
  value: string | "all";
};

const filterOptions: FilterOption[] = [
  { label: "All", value: "all" },
  { label: "Shelter", value: "shelter" },
  { label: "Sleep", value: "sleep" },
  { label: "Kitchen", value: "kitchen" },
  { label: "Electronics", value: "electronics" },
  { label: "Clothing", value: "clothing" },
  { label: "Footwear", value: "footwear" },
  { label: "Accessories", value: "accessories" },
  { label: "Miscellaneous", value: "miscellaneous" },
];

function CatalogItemsScreen() {
  const router = useRouter();
  const { data: catalogItems, isLoading, isError, refetch } = useCatalogItems();
  const [searchValue, setSearchValue] = useAtom(searchValueAtom);
  const [activeFilter, setActiveFilter] = useState<string | "all">("all");

  useHeaderSearchBar({
    hideWhenScrolling: false,
    onChangeText: (text) => setSearchValue(String(text)),
  });

  const handleItemPress = (item: CatalogItem) => {
    // Navigate to catalog item detail screen
    router.push({ pathname: "/catalog/[id]", params: { id: item.id } });
  };

  const filteredItems = catalogItems
    ? catalogItems.filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchValue.toLowerCase()) ||
          item.brand?.toLowerCase().includes(searchValue.toLowerCase()); // TODO: resolve bug here that cause matchesSearch to be false after navigating back from details screen

        const matchesCategory =
          activeFilter === "all" || item.category?.toLocaleLowerCase() === activeFilter;

        // return !!(matchesSearch && matchesCategory);
        return !!matchesCategory;
      })
    : [];

  const renderFilterChip = ({ label, value }: FilterOption) => (
    <TouchableOpacity
      key={value}
      onPress={() => setActiveFilter(value)}
      className={`mr-2 rounded-full px-4 py-2 ${activeFilter === value ? "bg-primary" : "bg-card"}`}
    >
      <Text
        className={`text-sm font-medium ${activeFilter === value ? "text-primary-foreground" : "text-foreground"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title="Catalog"
        backVisible={false}
        searchBar={{ iosHideWhenScrolling: true }}
      />

      <View className="bg-background px-4 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
          {filterOptions.map(renderFilterChip)}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator className="text-primary" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-4 pt-4">
              <CatalogItemCard item={item} onPress={() => handleItemPress(item)} />
            </View>
          )}
          ListHeaderComponent={
            <View className="px-4 pb-0 pt-2">
              <Text className="text-muted-foreground">
                {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-8">
              <View className="mb-4 rounded-full bg-muted p-4">
                <Icon name="search-outline" size={32} color="text-muted-foreground" />
              </View>
              <Text className="mb-1 text-lg font-medium text-foreground">No items found</Text>
              <Text className="mb-6 text-center text-muted-foreground">
                {activeFilter === "all"
                  ? "Try adjusting your search terms."
                  : `No ${activeFilter} items match your search.`}
              </Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  );
}

export default withAuthWall(CatalogItemsScreen, CatalogItemsAuthWall);
