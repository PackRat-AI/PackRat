import { View, TouchableOpacity, Linking } from 'react-native';
import { Icon } from '@roninoss/icons';
import type { ItemLink } from 'expo-app/types';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from 'expo-app/lib/useColorScheme';

type ItemLinksProps = {
  links: ItemLink[];
};

export function ItemLinks({ links }: ItemLinksProps) {
  if (!links || links.length === 0) return null;
  const { colors } = useColorScheme();

  const getIconName = (type: ItemLink['type']) => {
    switch (type) {
      case 'official':
        return 'globe-model';
      case 'review':
        return 'star-outline';
      case 'guide':
        return 'book-open-outline';
      case 'purchase':
        return 'cart';
      default:
        return 'link';
    }
  };

  const handleLinkPress = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.error(`Cannot open URL: ${url}`);
    }
  };

  return (
    <View className="my-8">
      <Text variant="callout" className="mb-2">
        Links
      </Text>
      <View className="rounded-lg">
        {links.map((link) => (
          <TouchableOpacity
            key={link.id}
            className="flex-row items-center border-b border-border p-3 last:border-b-0"
            onPress={() => handleLinkPress(link.url)}>
            <Icon name={getIconName(link.type)} size={18} color={colors.primary} />
            <View className="ml-3 flex-1">
              <Text className="text-foreground">{link.title}</Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {link.url}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.grey2} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
