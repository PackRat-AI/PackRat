import { Icon } from '@roninoss/icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';
import { useActiveLocation } from '../hooks';
import { WeatherIcon } from './WeatherIcon';
import { ListItem } from 'nativewindui/List';

export function WeatherTile() {
  const { activeLocation } = useActiveLocation();
  const { colors } = useColorScheme();

  const handlePress = () => {
    router.push('/weather');
  };

  return (
    <View>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-blue-500">
              <WeatherIcon
                condition={activeLocation?.condition || 'partly cloudy'}
                code={activeLocation?.details?.weatherCode}
                isDay={activeLocation?.details?.isDay}
                size={15}
                color="white"
              />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            {activeLocation && (
              <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
                {activeLocation.temperature}° • {activeLocation.condition}
              </Text>
            )}
            <Icon name="chevron-right" size={17} color={colors.grey} />
          </View>
        }
        item={{
          title: 'Weather',
          subTitle: activeLocation ? activeLocation.name : 'See weather updates',
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
      />
    </View>
  );
}
