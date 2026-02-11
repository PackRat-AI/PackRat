import type { AlertRef } from '@packrat/ui/nativewindui';
import {
  ActivityIndicator,
  Alert,
  Avatar,
  AvatarFallback,
  Button,
  ESTIMATED_ITEM_HEIGHT,
  List,
  ListItem,
  type ListRenderItemInfo,
  ListSectionHeader,
  Text,
  useColorScheme,
} from '@packrat/ui/nativewindui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { ProfileAuthWall } from 'expo-app/features/profile/components';
import { cn } from 'expo-app/lib/cn';
import { hasUnsyncedChanges } from 'expo-app/lib/hasUnsyncedChanges';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Platform, SafeAreaView, View } from 'react-native';

const ESTIMATED_ITEM_SIZE =
  ESTIMATED_ITEM_HEIGHT[Platform.OS === 'ios' ? 'titleOnly' : 'withSubTitle'];

function Profile() {
  const user = useUser();
  const { t } = useTranslation();

  const SCREEN_OPTIONS = {
    title: t('profile.profile'),
    headerShown: false,
  } as const;

  // Generate display data based on user information
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] || 'User';

  const email = user?.email || '';

  // Create data array with user information
  const DATA: DataItem[] = [
    ...(Platform.OS !== 'ios' ? [t('profile.accountInformation')] : []),
    {
      id: 'name',
      title: t('common.name'),
      ...(Platform.OS === 'ios' ? { value: displayName } : { subTitle: displayName }),
    },
    {
      id: 'email',
      title: t('common.email'),
      ...(Platform.OS === 'ios' ? { value: email } : { subTitle: email }),
    },
  ];

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />

      <List
        contentContainerClassName="pt-8"
        variant="insets"
        data={DATA}
        sectionHeaderAsGap={Platform.OS === 'ios'}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        renderItem={renderItem}
        ListHeaderComponent={<ListHeaderComponent />}
        ListFooterComponent={<ListFooterComponent />}
      />
    </>
  );
}

export default withAuthWall(Profile, ProfileAuthWall);

function renderItem(info: ListRenderItemInfo<DataItem>) {
  return <Item info={info} />;
}

function Item({ info }: { info: ListRenderItemInfo<DataItem> }) {
  if (typeof info.item === 'string') {
    return <ListSectionHeader {...info} />;
  }
  return (
    <ListItem
      titleClassName="text-lg"
      rightView={
        <View className="flex-1 flex-row items-center gap-0.5 px-2">
          {!!info.item.value && <Text className="text-muted-foreground">{info.item.value}</Text>}
        </View>
      }
      {...info}
    />
  );
}

function ListHeaderComponent() {
  const user = useUser();
  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] || 'User';

  const username = user?.email || '';

  return (
    <SafeAreaView className="ios:pb-8 items-center pb-4 pt-8">
      <Avatar alt={`${displayName}'s Profile`} className="h-24 w-24">
        <AvatarFallback>
          <Text
            variant="largeTitle"
            className={cn(
              'font-medium text-white dark:text-background',
              Platform.OS === 'ios' && 'dark:text-foreground',
            )}
          >
            {initials}
          </Text>
        </AvatarFallback>
      </Avatar>
      <View className="p-1" />
      <Text variant="title1">{displayName}</Text>
      <Text className="text-muted-foreground">{username}</Text>
    </SafeAreaView>
  );
}

function ListFooterComponent() {
  const { signOut } = useAuth();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const alertRef = useRef<AlertRef>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      alertRef.current?.alert({
        title: t('auth.loggedOut'),
        message: t('auth.loggedOutMessage'),
        materialIcon: { name: 'check-circle-outline', color: colors.green },
        buttons: [
          {
            text: t('auth.stayLoggedOut'),
            style: 'cancel',
            onPress: async () => {
              await AsyncStorage.setItem('skipped_login', 'true');
              await Updates.reloadAsync();
            },
          },
          {
            text: t('auth.signInAgain'),
            style: 'default',
            onPress: async () => {
              await AsyncStorage.setItem('skipped_login', 'false');
              await Updates.reloadAsync();
            },
          },
        ],
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View className="ios:px-0 px-4 pt-8">
      <Button
        disabled={isSigningOut}
        onPress={() => {
          if (hasUnsyncedChanges()) {
            alertRef.current?.alert({
              title: t('profile.syncInProgress'),
              message: t('profile.syncMessage'),
              materialIcon: { name: 'repeat' },
              buttons: [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                },
                {
                  text: t('auth.logOut'),
                  style: 'destructive',
                  onPress: handleSignOut,
                },
              ],
            });
            return;
          }
          handleSignOut();
        }}
        size="lg"
        variant={Platform.select({ ios: 'primary', default: 'secondary' })}
        className="border-border bg-card"
      >
        {isSigningOut ? (
          <ActivityIndicator className="text-destructive" />
        ) : (
          <Text className="text-destructive">{t('auth.logOut')}</Text>
        )}
      </Button>
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}

type DataItem =
  | string
  | {
      id: string;
      title: string;
      value?: string;
      subTitle?: string;
      onPress?: () => void;
    };
