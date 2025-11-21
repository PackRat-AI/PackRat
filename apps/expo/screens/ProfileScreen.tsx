import { Icon } from '@roninoss/icons';
import { UserAvatar } from 'expo-app/components/initial/UserAvatar';
import type { Pack } from 'expo-app/features/packs';
import { PackCard } from 'expo-app/features/packs/components/PackCard';
import { usePacks } from 'expo-app/features/packs/hooks/usePacks';
import { getPackItems } from 'expo-app/features/packs/store';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { currentUser } from '../data/mockData';

export function ProfileScreen() {
  const packs = usePacks();
  const { t } = useTranslation();

  const handlePackPress = (pack: Pack) => {
    // In a real app, you would navigate to the pack details screen
    console.log('Navigate to pack details:', pack.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3">
        <TouchableOpacity onPress={() => console.log('Go back')} className="mr-3">
          <Icon name="chevron-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-semibold text-gray-900">{t('profile.profile')}</Text>
        <TouchableOpacity>
          <Icon name="cog-outline" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView>
        <View className="mb-4 items-center bg-white p-4">
          <UserAvatar user={currentUser} size="lg" />
          <Text className="mt-2 text-xl font-bold text-gray-900">{currentUser.name}</Text>
          <View className="mt-1 rounded-full bg-blue-100 px-2 py-1">
            <Text className="text-xs font-medium capitalize text-blue-800">
              {currentUser.experience}
            </Text>
          </View>

          {currentUser.bio && (
            <Text className="mt-3 text-center text-gray-600">{currentUser.bio}</Text>
          )}

          <Text className="mt-3 text-xs text-gray-500">
            {t('profile.memberSince', { date: formatDate(currentUser.joinedAt) })}
          </Text>

          <TouchableOpacity className="mt-4 rounded-lg bg-blue-500 px-4 py-2">
            <Text className="font-medium text-white">{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-4 bg-white">
          <View className="border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold text-gray-900">{t('profile.myPacks')}</Text>
          </View>

          {packs && packs.length > 0 ? (
            packs.map((pack) => (
              <View key={pack.id} className="px-4 pt-4 last:pb-4">
                <PackCard pack={pack} onPress={handlePackPress} />
              </View>
            ))
          ) : (
            <View className="items-center p-4">
              <Text className="text-gray-500">{t('profile.noPacksYet')}</Text>
            </View>
          )}

          <TouchableOpacity className="m-4 items-center rounded-lg bg-blue-500 py-3">
            <Text className="font-semibold text-white">{t('profile.createNewPack')}</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-4 bg-white">
          <View className="border-b border-gray-200 px-4 py-3">
            <Text className="text-lg font-semibold text-gray-900">{t('profile.stats')}</Text>
          </View>

          <View className="flex-row justify-between p-4">
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900">{packs?.length}</Text>
              <Text className="text-gray-500">{t('navigation.packs')}</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900">
                {packs?.reduce((total, pack) => total + (getPackItems(pack.id)?.length ?? 0), 0)}
              </Text>
              <Text className="text-gray-500">{t('profile.items')}</Text>
            </View>

            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900">
                {packs?.filter((pack) => pack.isPublic).length}
              </Text>
              <Text className="text-gray-500">{t('profile.public')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
