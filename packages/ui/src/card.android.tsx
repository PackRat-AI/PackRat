import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';
import type { CardProps } from './card-parts';

const DEFAULT_ELEVATION = 2;

/**
 * Android `Card` — a plain React Native surface drawn to match Material 3's elevated card: the card
 * colour, 12dp corners and elevation 2.
 *
 * Not the Compose `Card` from `@expo/ui`. That hosted its RN children through `RNHostView
 * matchContents`, which reports its size asynchronously after mount, so inside a FlatList or
 * ScrollView every card mounted at the wrong height and resized a frame later: blank or clipped
 * cards, and the rows below jumping while the list loaded and scrolled (#2767, #2871). A plain view
 * lays out in the same pass as its children.
 *
 * Call sites that pass `rootClassName="… shadow-none bg-inherit"` are opting out of the card surface
 * to draw their own border. That intent is read here and drawn the way the Compose card drew it — no
 * elevation, a 1dp `grey5` border, the screen background as the fill — rather than forwarding the
 * className, so those cards look exactly as before. `rootStyle` still passes through.
 */
function Card({ className, rootClassName, rootStyle, ...props }: CardProps) {
  const { colors } = useColorScheme();

  const flat = rootClassName?.includes('shadow-none') ?? false;
  const bordered = flat && (rootClassName?.includes('border') ?? false);
  // `bg-inherit` means "don't paint your own fill", which for a card means the screen background.
  const transparent = rootClassName?.includes('bg-inherit') ?? false;

  return (
    <View
      className="rounded-xl"
      style={[
        {
          backgroundColor: transparent ? colors.background : colors.card,
          elevation: flat ? 0 : DEFAULT_ELEVATION,
        },
        bordered && { borderWidth: 1, borderColor: colors.grey5 },
        rootStyle,
      ]}
    >
      <View className={cn('justify-end overflow-hidden rounded-xl', className)} {...props} />
    </View>
  );
}

export { CardContent, CardDescription, CardFooter, CardSubtitle, CardTitle } from './card-parts';
export { Card };
export type { CardProps };
