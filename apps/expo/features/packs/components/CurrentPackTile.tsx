import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { Image, View } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from 'nativewindui/Avatar';
import { ListItem } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';
import { useCurrentPack } from '../hooks';

const LOGO_SOURCE = require('~/assets/packrat-app-icon-gradient.png');

export function CurrentPackTile() {
  const currentPack = useCurrentPack();

  const router = useRouter();

  const avatarImage =
    currentPack?.image ??
    'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=400&auto=format&fit=crop&b=2s';

  const handlePress = () => {
    if (!currentPack) return router.push('/pack/new');
    router.push(`/current-pack/${currentPack.id}`);
  };

  return (
    <ListItem
      className={'ios:pl-0 pl-2'}
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <Avatar alt="Current pack avatar">
            <AvatarImage source={{ uri: avatarImage }} />
            <AvatarFallback>
              <Text>{currentPack ? currentPack.name.slice(0, 2).toUpperCase() : 'NA'}</Text>
            </AvatarFallback>
          </Avatar>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
            {currentPack ? `${currentPack.totalWeight} g` : ''}
          </Text>
          <ChevronRight />
        </View>
      }
      item={{
        title: 'Current Pack',
        subTitle: currentPack ? currentPack.name : 'Create your first pack to start tracking',
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
