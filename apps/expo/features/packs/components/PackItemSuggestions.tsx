import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { isAuthed } from 'expo-app/features/auth/store';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { usePackItemSuggestions } from '../hooks';
import { ItemSuggestionCard } from './ItemSuggestionCard';
import { PackItemSuggestionSkeleton } from './PackItemSuggestionSkeleton';

interface AISuggestionsProps {
  packId: string;
}

export function PackItemSuggestions({ packId }: AISuggestionsProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const {
    data: suggestions,
    isLoading,
    refetch,
    isError,
  } = usePackItemSuggestions(packId, showSuggestions);

  const { colors } = useColorScheme();

  const handleGenerateSuggestions = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: `/pack/${packId}`,
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
      <View className="bg-card p-4">
        <Button onPress={handleGenerateSuggestions} className="w-full" variant="secondary">
          <Icon name="atom" size={18} color={colors.foreground} />
          <Text>Get AI Item Suggestions</Text>
        </Button>
      </View>
    );
  }

  // Show loading state
  if (isLoading) {
    return <PackItemSuggestionSkeleton hideSuggestions={handleHideSuggestions} />;
  }

  // Handle error state
  if (isError || !suggestions || suggestions.length === 0) {
    return (
      <View className="mb-4 bg-card p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Icon name="atom" size={18} />
            <Text className="text-base font-semibold text-gray-700">AI Suggestions</Text>
          </View>
          <TouchableOpacity
            onPress={handleHideSuggestions}
            className="rounded-full bg-gray-200 p-1"
          >
            <Icon name="close" size={16} />
          </TouchableOpacity>
        </View>

        <Text className="mb-3 text-sm text-muted-foreground">
          {isError
            ? "Couldn't generate suggestions. Try again later."
            : 'No suggestions available for your pack.'}
        </Text>

        <Button onPress={() => refetch()} variant="secondary" className="w-full">
          <Icon name="power-cycle" size={16} />
          <Text>Try Again</Text>
        </Button>
      </View>
    );
  }

  // Show suggestions
  return (
    <View className="mb-4 bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Icon name="atom" size={18} />
          <Text className="text-base font-semibold text-gray-700">AI Suggestions</Text>
        </View>
        <TouchableOpacity onPress={handleHideSuggestions} className="rounded-full bg-gray-200 p-1">
          <Icon name="close" size={16} />
        </TouchableOpacity>
      </View>

      <Text className="mb-3 text-sm text-muted-foreground">
        Items you might want to add to your pack
      </Text>

      <FlatList
        data={suggestions}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        className="mb-2"
        renderItem={({ item }) => <ItemSuggestionCard item={item} packId={packId} />}
      />
    </View>
  );
}
