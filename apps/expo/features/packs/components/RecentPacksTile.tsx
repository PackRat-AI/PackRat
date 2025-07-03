import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/nativewindui/Avatar';
import { ListItem } from '~/components/nativewindui/List';
import { Text } from '~/components/nativewindui/Text';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/hooks/useColorScheme';
import { useRecentPacks } from '../hooks/useRecentPacks';

export function RecentPacksTile() {
  const recentPacks = useRecentPacks();

  const router = useRouter();

  const fallbackImage =
    'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=400&auto=format&fit=crop';

  const handlePress = () => {
    router.push('/recent-packs');
  };
  return (
    <ListItem
      className={'ios:pl-0 pl-2'}
      titleClassName="text-lg"
      leftView={
        <View className="flex-row px-3">
          {recentPacks.slice(0, 2).map((pack, index) => {
            const img = pack?.image ?? fallbackImage;
            return (
              <Avatar
                key={index}
                alt={`${pack?.name ?? ''} avatar`}
                className={cn('h-6 w-6', index > 0 && '-ml-2')}
              >
                <AvatarImage source={{ uri: img }} />
                <AvatarFallback>
                  <Text>{pack?.name.slice(0, 2).toUpperCase() ?? 'NA'}</Text>
                </AvatarFallback>
              </Avatar>
            );
          })}
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Text variant="footnote" className="font-bold leading-4 text-primary-foreground">
              {recentPacks.length}
            </Text>
          </View>
          <ChevronRight />
        </View>
      }
      item={{
        title: 'Recent Packs',
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
