import { useAtomValue } from 'jotai';
import { FlatList, SafeAreaView, Text, View } from 'react-native';
import { authAtom } from '~/atoms/authAtoms';
import { PackCard } from '~/components/initial/PackCard';
import { UserAvatar } from '~/components/initial/UserAvatar';
import { usePacks } from '~/hooks/usePacks';
import type { Pack } from '~/types';

export function HomeScreen() {
  const user = useAtomValue(authAtom);
  const { data: packs, isLoading } = usePacks();

  const handlePackPress = (pack: Pack) => {
    // In a real app, you would navigate to the pack details screen
    console.log('Navigate to pack details:', pack.id);
  };

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!user) {
    return <Text>User not found</Text>;
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">My Packs</Text>
          <UserAvatar user={user} size="sm" />
        </View>
      </View>

      <FlatList
        data={packs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pt-4">
            <PackCard pack={item} onPress={handlePackPress} />
          </View>
        )}
        ListHeaderComponent={
          <View className="px-4 pb-2 pt-4">
            <Text className="text-gray-500">Showing {packs?.length} packs</Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center p-4">
            <Text className="text-gray-500">No packs found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
