import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Icon } from '@roninoss/icons';

export function PackItemSuggestionSkeleton({ hideSuggestions }: { hideSuggestions: () => void }) {
  return (
    <View className="mb-4 bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Icon name="atom" size={18} />
          <Text className="text-base font-semibold text-gray-700">AI Suggestions</Text>
        </View>
        <TouchableOpacity onPress={hideSuggestions} className="rounded-full bg-gray-200 p-1">
          <Icon name="close" size={16} />
        </TouchableOpacity>
      </View>

      <Text className="mb-3 text-sm text-muted-foreground">Finding items for your pack...</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[1, 2, 3].map((i) => (
          <View key={i} className="mr-2 w-40 rounded-lg border border-border bg-card p-3">
            <View className="mb-1 h-4 w-3/4 rounded bg-muted" />
            <View className="mb-1 h-3 w-full rounded bg-muted" />
            <View className="mb-2 h-3 w-2/3 rounded bg-muted" />
            <View className="flex-row items-center justify-between">
              <View className="h-3 w-1/4 rounded bg-muted" />
              <View className="h-8 w-8 rounded-full bg-muted" />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
