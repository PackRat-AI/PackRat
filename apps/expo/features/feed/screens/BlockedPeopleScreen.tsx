import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack } from 'expo-router';
import { useRef } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { PersonAvatar } from '../components/PersonAvatar';
import { useBlockedPeople, useUnblockUser } from '../hooks/useSocialSettings';
import type { PostAuthor } from '../types';
import { feedErrorMessage } from '../utils/errorCopy';
import { displayName } from '../utils/mentions';

/** Everyone the user has blocked, from the feed or trail reports, each of whom can be unblocked. */
export function BlockedPeopleScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const alertRef = useRef<AlertMethods>(null);
  const blocked = useBlockedPeople();
  const unblock = useUnblockUser();

  const confirmUnblock = (person: PostAuthor) => {
    const name = displayName(person) || t('feed.packratMember');
    alertRef.current?.alert({
      title: t('feed.unblockTitle', { name }),
      message: t('feed.unblockBody'),
      buttons: [
        { text: t('feed.cancel'), style: 'cancel' },
        {
          text: t('feed.unblock'),
          onPress: () =>
            unblock.mutate(person, {
              onError: (error) =>
                alertRef.current?.alert({
                  title: t('feed.unblockFailed', { name }),
                  message: feedErrorMessage({
                    error: error,
                    fallback: t('feed.somethingWentWrong'),
                  }),
                  buttons: [{ text: t('feed.ok') }],
                }),
            }),
        },
      ],
    });
  };

  return (
    <View className="flex-1 bg-background" testID={testIds.feed.blockedPeople}>
      <Stack.Screen options={{ title: t('feed.blockedPeople') }} />
      {blocked.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={blocked.data ?? []}
          keyExtractor={(person) => person.id}
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 8 }}
          renderItem={({ item }) => (
            <View className="min-h-[64px] flex-row items-center gap-4 px-4">
              <PersonAvatar person={item} size={40} />
              <Text className="flex-1 text-base">
                {displayName(item) || t('feed.packratMember')}
              </Text>
              <Pressable
                onPress={() => confirmUnblock(item)}
                className="h-10 justify-center rounded-full border border-border px-4"
                accessibilityRole="button"
                android_ripple={{ color: colors.grey5 }}
                testID={testIds.feed.unblock(item.id)}
              >
                <Text variant="callout" className="font-medium text-primary">
                  {t('feed.unblock')}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 px-8 pb-24">
              <Icon
                name={blocked.isError ? 'cloud-off-outline' : 'account-cancel-outline'}
                size={56}
                color={colors.grey}
              />
              <Text className="text-center text-xl font-medium">
                {blocked.isError ? t('feed.blockedLoadFailed') : t('feed.noOneBlocked')}
              </Text>
              {blocked.isError ? (
                <Pressable
                  onPress={() => blocked.refetch()}
                  className="h-10 justify-center rounded-full border border-border px-4"
                  accessibilityRole="button"
                >
                  <Text variant="callout" className="font-medium text-primary">
                    {t('feed.tryAgain')}
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-center text-muted-foreground" wrap>
                  {t('feed.noOneBlockedBody')}
                </Text>
              )}
            </View>
          }
        />
      )}
      <Alert ref={alertRef} title="" buttons={[]} />
    </View>
  );
}
