import type { WeatherAttribution as WeatherAttributionData } from '@packrat/schemas/weather';
import { Text } from '@packrat/ui/src/text';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Image, Linking, Pressable, View } from 'react-native';

// The mark's artwork is 3x, roughly 6.4:1; 12pt tall matches the caption text.
const LOGO_HEIGHT = 12;
const LOGO_WIDTH = 77;

/**
 * The Apple Weather mark and its legal link, shown under any forecast that
 * includes Apple Weather days — Apple's terms require both wherever that data
 * appears. Always sits on the sky gradient, so it uses the white mark.
 */
export function WeatherAttribution({ attribution }: { attribution: WeatherAttributionData }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 px-1">
      <Image
        source={{ uri: attribution.logoDarkUrl }}
        style={{ height: LOGO_HEIGHT, width: LOGO_WIDTH }}
        resizeMode="contain"
        accessibilityLabel={attribution.serviceName}
      />
      <Pressable
        onPress={() => Linking.openURL(attribution.legalPageUrl)}
        accessibilityRole="link"
        hitSlop={12}
        testID={testIds.weather.attributionLegal}
      >
        <Text variant="caption2" className="text-white/70 underline">
          {t('weather.attributionLegal')}
        </Text>
      </Pressable>
    </View>
  );
}
