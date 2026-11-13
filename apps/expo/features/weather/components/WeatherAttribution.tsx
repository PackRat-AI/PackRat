import type { WeatherAttribution as WeatherAttributionData } from '@packrat/schemas/weather';
import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Image, Linking, Pressable, View } from 'react-native';

// The mark's artwork is 3x, roughly 6.4:1; 12pt tall matches the caption text.
const LOGO_HEIGHT = 12;
const LOGO_WIDTH = 77;

/**
 * The Apple Weather mark and its legal link, shown under any forecast that
 * includes Apple Weather days — Apple's terms require both wherever that data
 * appears. On the sky gradient it uses the white mark; on a card it follows the colour scheme.
 */
export function WeatherAttribution({
  attribution,
  onCard = false,
}: {
  attribution: WeatherAttributionData;
  onCard?: boolean;
}) {
  const { t } = useTranslation();
  const { isDarkColorScheme } = useColorScheme();
  const light = onCard && !isDarkColorScheme;
  return (
    <View className="flex-row items-center gap-2 px-1">
      <Image
        source={{ uri: light ? attribution.logoLightUrl : attribution.logoDarkUrl }}
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
        <Text
          variant="caption2"
          className={`underline ${onCard ? 'text-muted-foreground' : 'text-white/70'}`}
        >
          {t('weather.attributionLegal')}
        </Text>
      </Pressable>
    </View>
  );
}
