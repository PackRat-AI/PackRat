import { Image, Text, View } from 'react-native';

type UserLike = {
  name: string;
  avatarUrl?: string | null;
};

type UserAvatarProps = {
  user: UserLike;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
};

export function UserAvatar({ user, size = 'md', showName = false }: UserAvatarProps) {
  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }[size];

  const fontClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  const avatarUri = user.avatarUrl || null;

  return (
    <View className="flex-row items-center">
      <View className={`${sizeClass} overflow-hidden rounded-full bg-gray-200`}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-blue-500">
            <Text className="font-bold text-white">{user.name.substring(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </View>

      {showName && (
        <Text className={`ml-2 font-medium text-gray-900 ${fontClass}`}>{user.name}</Text>
      )}
    </View>
  );
}
