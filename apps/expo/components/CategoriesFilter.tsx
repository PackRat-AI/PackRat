import { Ionicons } from '@expo/vector-icons';
import { Text } from '@packrat/ui/nativewindui';
import { ScrollView, TouchableOpacity, View } from 'react-native';

export function CategoriesFilter({
  activeFilter,
  onFilter,
  data,
  error,
  retry,
}: {
  activeFilter: string;
  onFilter: (filter: string) => void;
  data: string[] | undefined;
  error?: Error | null;
  retry?: (() => void) | undefined;
}) {
  if (error)
    return (
      <View className="mx-4 mb-2 rounded-lg bg-destructive/10 dark:bg-destructive/20 p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text className="ml-2 text-sm text-destructive">Failed to load categories</Text>
          </View>
          {retry && (
            <TouchableOpacity onPress={retry} className="ml-2 rounded px-2 py-1 bg-destructive/20">
              <Text className="text-xs text-destructive font-medium">Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
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
