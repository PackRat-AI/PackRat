import { ListItem, Text, Button } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { isAuthed } from 'expo-app/features/auth/store';
import { useOnDeviceAI } from 'expo-app/features/ai/hooks/useOnDeviceAI';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { type Href, useRouter } from 'expo-router';
import { Platform, View } from 'react-native';

export function AIChatTile() {
  const router = useRouter();
  const { isOnDeviceAvailable, recommendedProvider } = useOnDeviceAI();

  const route: Href = {
    pathname: '/ai-demo', // Changed to demo page to show both options
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
          <View className="flex-1">
            <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
              Anything outdoors...
            </Text>
            {isOnDeviceAvailable && (
              <Text variant="caption2" className="ios:px-0 px-2 text-success">
                ✓ On-device ready
              </Text>
            )}
          </View>
          <ChevronRight />
        </View>
      }
      item={{
        title: 'PackRat AI',
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
      removeSeparator={Platform.OS === 'ios'}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
