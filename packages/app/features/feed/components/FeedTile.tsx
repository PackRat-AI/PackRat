import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'app/components/Icon';
import { useColorScheme } from 'app/lib/hooks/useColorScheme';
import { useTranslation } from 'app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export const FeedTile = () => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const handlePress = () => {
    router.push('/(app)/(tabs)/feed');
  };

  return (
    <ListItem
      className={'ios:pl-0 pl-2'}
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon
              ios={{ useMaterialIcon: true }}
              name="image-multiple"
              size={24}
              color={colors.primary}
            />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
            {t('feed.viewFeed')}
          </Text>
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{
        title: t('feed.feed'),
        subTitle: t('feed.shareMoments'),
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
    />
  );
};
