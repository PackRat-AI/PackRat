import { Text } from '@packrat/ui/nativewindui';
import { ScrollView, TouchableOpacity, View } from 'react-native';

export function CategoriesFilter({
  activeFilter,
  onFilter,
  data,
}: {
  activeFilter: string;
  onFilter: (filter: string) => void;
  data: string[] | undefined;
}) {
  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      onPress={() => onFilter(filter)}
      className={`mr-2 rounded-full px-4 py-2 ${activeFilter === filter ? 'bg-primary' : 'bg-card'}`}
    >
      <Text
        className={`text-sm font-medium ${
          activeFilter === filter ? 'text-primary-foreground' : 'text-foreground'
        }`}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="bg-background px-4 py-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
        {!data
          ? Array.from({ length: 10 }).map((_, i) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: just for skeleton
                key={i}
                className="h-8 w-20 rounded-full mr-2 bg-neutral-300 dark:bg-neutral-600 animate-pulse"
              />
            ))
          : data.map(renderFilterChip)}
      </ScrollView>
    </View>
  );
}
