import { cn } from 'expo-app/lib/cn';
import { Platform, View } from 'react-native';
import type { CardProps } from './card-parts';

/**
 * iOS/web `Card` surface — Android uses `card.android.tsx` (Material 3 `Card` + `RNHostView`).
 *
 * Kept as RN composition here deliberately. SwiftUI has no direct `Card` equivalent; the iOS look is
 * a rounded container with a soft shadow, which this already draws. Web needs a real RN fallback
 * regardless, since `@expo/ui` has no web target.
 */
function Card({ className, rootClassName, rootStyle, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'bg-card rounded-xl shadow-2xl',
        Platform.OS === 'ios' && 'rounded-2xl shadow-xl shadow-black/15',
        rootClassName,
      )}
      style={rootStyle}
    >
      <View
        className={cn('ios:rounded-2xl justify-end overflow-hidden rounded-xl', className)}
        {...props}
      />
    </View>
  );
}

export { CardContent, CardDescription, CardFooter, CardSubtitle, CardTitle } from './card-parts';
export { Card };
export type { CardProps };
