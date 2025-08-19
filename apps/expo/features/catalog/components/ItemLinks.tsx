import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Linking, TouchableOpacity, View } from 'react-native';

type ItemLinksProps = {
  links: CatalogItem['links'];
};

export function ItemLinks({ links }: ItemLinksProps) {
  const { colors } = useColorScheme();

  if (!links || links.length === 0) return null;

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
            key={link.url}
            className="flex-row items-center border-b border-border p-3 last:border-b-0"
            onPress={() => handleLinkPress(link.url)}
          >
            <Icon name="link" size={18} color={colors.primary} />
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
