import { Icon } from '@roninoss/icons';
import { Href, useRouter } from 'expo-router';
import { View } from 'react-native';
import { ListItem } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { isAuthed } from '~/features/auth/store';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/useColorScheme';

export function AIChatTile() {
  const router = useRouter();

  const route: Href = {
    pathname: '/ai-chat',
    params: {
      contextType: 'general',
    },
  };
  const handlePress = () => {
    if (!isAuthed.peek()) {
      // AI featuer is protected. Redirect user to the auth page if not authenticated.
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: JSON.stringify(route), // stringifying to pass along parameters
          showSignInCopy: 'true',
        },
      });
    }

    router.push(route);
  };

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-purple-500">
            <Icon name="message" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
            Anything outdoors...
          </Text>
          <ChevronRight />
        </View>
      }
      item={{
        title: 'PackRat AI',
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
