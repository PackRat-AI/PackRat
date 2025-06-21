import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ListItem } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';

export function ShoppingListTile() {
  const router = useRouter();

  const handlePress = () => {
    router.push('/shopping-list');
  };

  const shoppingList = 10;

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-gray-600">
            <Icon name="cart-outline" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Text variant="footnote" className="font-bold leading-4 text-primary-foreground">
              {shoppingList}
            </Text>
          </View>
          <ChevronRight />
        </View>
      }
      item={{
        title: 'Shopping List',
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
