import { clientEnvs } from '@packrat/env/expo-client';
import type { AlertMethods } from '@packrat/ui/nativewindui';
import {
  ActivityIndicator,
  Alert as AlertComponent,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  LargeTitleHeader,
  List,
  ListItem,
  type ListRenderItemInfo,
  ListSectionHeader,
  Text,
} from '@packrat/ui/nativewindui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from 'expo-app/components/Icon';
import TabScreen from 'expo-app/components/TabScreen';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useImagePicker } from 'expo-app/features/packs/hooks/useImagePicker';
import { uploadImage } from 'expo-app/features/packs/utils/uploadImage';
import { ProfileAuthWall } from 'expo-app/features/profile/components';
import { useUpdateProfile } from 'expo-app/features/profile/hooks/useUpdateProfile';
import { cn } from 'expo-app/lib/cn';
import { hasUnsyncedChanges } from 'expo-app/lib/hasUnsyncedChanges';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TestIds } from 'expo-app/lib/testIds';
import { buildPackTemplateItemImageUrl } from 'expo-app/lib/utils/buildPackTemplateItemImageUrl';
import * as FileSystem from 'expo-file-system/legacy';
import { Link, router, Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function SettingsIcon() {
  const { colors } = useColorScheme();
  return (
    <Link href="/settings" asChild>
      <Pressable className="opacity-80">
        {({ pressed }) => (
          <View className={cn(pressed ? 'opacity-50' : 'opacity-90')}>
            <Icon name="cog-outline" color={colors.foreground} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function DemoIcon() {
  const { colors } = useColorScheme();
  if (clientEnvs.NODE_ENV !== 'development') return null;

  return (
    <Link href="/demo" asChild>
      <Pressable className="opacity-80">
        {({ pressed }) => (
          <View className={cn(pressed ? 'opacity-50' : 'opacity-90')}>
            <Icon name="tag-outline" color={colors.foreground} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

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
      onPress: () => router.push('/(app)/(tabs)/profile/name'),
      ...(Platform.OS === 'ios' ? { value: displayName } : { subTitle: displayName }),
    },
    {
      id: 'email',
      title: t('common.email'),
      ...(Platform.OS === 'ios' ? { value: email } : { subTitle: email }),
    },
  ];

  return (
    <TabScreen>
      <Stack.Screen options={SCREEN_OPTIONS} />

      <LargeTitleHeader
        title={t('profile.profile')}
        backVisible={false}
        rightView={() => (
          <View className="flex-row items-center gap-2 pr-2 pl-2">
            <DemoIcon />

            <SettingsIcon />
          </View>
        )}
      />

      <List
        contentContainerClassName="pt-8"
        variant="insets"
        data={DATA}
        sectionHeaderAsGap={Platform.OS === 'ios'}
        renderItem={renderItem}
        ListHeaderComponent={<ListHeaderComponent />}
        ListFooterComponent={<ListFooterComponent />}
      />
    </TabScreen>
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
      onPress={info.item.onPress}
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
  const { updateProfile } = useUpdateProfile();
  const { pickImage } = useImagePicker();
  const [isUploading, setIsUploading] = useState(false);
  const { t } = useTranslation();

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] || 'User';

  const username = user?.email || '';

  // Build the full avatar URL from the stored R2 key or an absolute URL
  const avatarUri = user?.avatarUrl ? buildPackTemplateItemImageUrl(user.avatarUrl) : null;

  async function handleAvatarPress() {
    try {
      const image = await pickImage();
      if (!image) return;

      // Validate file size before uploading (5 MB limit)
      const info = await FileSystem.getInfoAsync(image.uri);
      if (info.exists && 'size' in info && info.size > AVATAR_MAX_BYTES) {
        Alert.alert(t('errors.somethingWentWrong'), t('profile.imageTooLarge'));
        return;
      }

      setIsUploading(true);
      const remoteFileName = await uploadImage(image.fileName, image.uri);
      if (remoteFileName) {
        const success = await updateProfile({ avatarUrl: remoteFileName });
        if (!success) {
          Alert.alert(t('errors.somethingWentWrong'), t('errors.tryAgain'));
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Permission to access media library was denied') {
        Alert.alert(t('permissions.photoLibraryTitle'), t('permissions.photoLibraryMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('permissions.openSettings'), onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert(t('errors.somethingWentWrong'), t('errors.tryAgain'));
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <SafeAreaView className="ios:pb-8 items-center pb-4 pt-8">
      <TouchableOpacity onPress={handleAvatarPress} disabled={isUploading}>
        <Avatar alt={`${displayName}'s Profile`} className="h-24 w-24">
          {avatarUri ? <AvatarImage source={{ uri: avatarUri }} /> : null}
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
        {isUploading && (
          <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
            <ActivityIndicator color="white" />
          </View>
        )}
      </TouchableOpacity>
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

  const alertRef = useRef<AlertMethods>(null);
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
        testID={TestIds.SignOutButton}
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
      <AlertComponent title="" buttons={[]} ref={alertRef} />
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
