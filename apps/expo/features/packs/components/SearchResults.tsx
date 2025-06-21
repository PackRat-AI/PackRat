import { FlatList, Pressable, Text, View } from 'react-native';
import { Icon } from '@roninoss/icons';
import type { Pack } from '../types';

type SearchResultsProps = {
  results: Omit<Pack, 'items' | 'baseWeight' | 'totalWeight'>[];
  searchValue: string;
  onResultPress: (pack: Omit<Pack, 'items' | 'baseWeight' | 'totalWeight'>) => void;
};

export function SearchResults({ results, searchValue, onResultPress }: SearchResultsProps) {
  if (!searchValue) return null;

  return (
    <View className="max-h-80 w-full rounded-lg bg-card shadow-sm">
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onResultPress(item)}
              className="flex-row items-center border-b border-border px-4 py-3 active:bg-muted"
            >
              <View className="mr-3 rounded-full bg-muted p-2">
                <Icon name="backpack" size={16} color="text-muted-foreground" />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-foreground">{item.name}</Text>
                <Text className="text-sm text-muted-foreground">{item.category}</Text>
              </View>
              <Icon name="chevron-right" size={16} color="text-muted-foreground" />
            </Pressable>
          )}
        />
      ) : (
        <View className="items-center justify-center p-4">
          <Text className="text-muted-foreground">No packs found for "{searchValue}"</Text>
        </View>
      )}
    </View>
  );
}
