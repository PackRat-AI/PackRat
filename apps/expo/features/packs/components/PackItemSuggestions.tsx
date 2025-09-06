import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { isAuthed } from 'expo-app/features/auth/store';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { usePackItemSuggestions } from '../hooks';
import type { Pack } from '../types';
import { ItemSuggestionCard } from './ItemSuggestionCard';

interface AISuggestionsProps {
  pack: Pack;
}

export function PackItemSuggestions({ pack }: AISuggestionsProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const {
    data: suggestions,
    isFetching: loading,
    refetch,
    isError,
  } = usePackItemSuggestions(pack, showSuggestions);

  const { colors } = useColorScheme();

  const handleGenerateSuggestions = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack/${pack.id}`,
          showSignInCopy: 'true',
        },
      });
    }
    setShowSuggestions(true);
    refetch();
  };

  const handleHideSuggestions = () => {
    setShowSuggestions(false);
  };

  // If suggestions aren't being shown, display the generate button
  if (!showSuggestions) {
    return (
      <View className="p-4">
        <Button onPress={handleGenerateSuggestions} className="w-full" variant="secondary">
          <Icon name="atom" size={18} color={colors.foreground} />
          <Text>Get AI Item Suggestions</Text>
        </Button>
      </View>
    );
  }

  const groupedData =
    suggestions?.reduce<Array<Array<(typeof suggestions)[0]>>>((acc, _item, i) => {
      if (i % 2 === 0) {
        acc.push(suggestions.slice(i, i + 2));
      }
      return acc;
    }, []) ?? [];

  // Show suggestions
  return (
    <View className="mb-4 p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="heading">AI Suggestions</Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => refetch()} className="p-1">
            <Icon name="restart" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleHideSuggestions} className="p-1">
            <Icon name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <Text className="mb-4 text-sm text-muted-foreground">
        {loading ? 'Finding items for your pack...' : 'Items you might want to add to your pack'}
      </Text>

      {loading ? (
        <View className="py-4">
          <ActivityIndicator />
        </View>
      ) : isError || suggestions?.length === 0 ? (
        <View className="p-4">
          <Text className="mb-3 text-sm text-center text-muted-foreground">
            Couldn't generate suggestions.
          </Text>

          <Button onPress={() => refetch()} variant="secondary" className="w-full gap-2">
            <Icon name="restart" size={16} />
            <Text>Try Again</Text>
          </Button>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {groupedData.map((pair) => (
            <View key={pair.map((i) => i.id).join()} className="mr-2 gap-y-2">
              {pair.map((item) => (
                <ItemSuggestionCard key={item.id} item={item} pack={pack} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
