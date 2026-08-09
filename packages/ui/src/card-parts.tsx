import { cn } from 'expo-app/lib/cn';
import { BlurView, type BlurViewProps } from 'expo-blur';
import { Platform, type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';
import { Text, type TextProps } from './text';

/**
 * The non-surface parts of `Card`, shared by every platform. Only `Card` itself — the surface that
 * draws the elevation and background — is platform-specific (see card.android.tsx).
 */

function CardContent({
  className,
  iosBlurIntensity = 3,
  iosBlurClassName,
  ...props
}: ViewProps & { iosBlurIntensity?: number; iosBlurClassName?: string }) {
  return (
    <>
      {Platform.OS === 'ios' && (
        <BlurView
          intensity={iosBlurIntensity}
          // `absolute inset-0` is load-bearing, not cosmetic. This blur is a *background fill*
          // behind the content, but it has no children, so laid out in flow it is still a real
          // flex child of `Card`'s `justify-end` column: Yoga gives it a share of the cross-axis
          // and it displaces the siblings after it. On the catalog card that pushed the content
          // block down until the last description line and the whole footer ran past the card's
          // `overflow-hidden` edge — the description clipped mid-line and the weight row was
          // sliced in half. Taking it out of flow makes it paint behind the content, which is
          // what a background blur is supposed to do.
          className={cn('absolute inset-0', iosBlurClassName)}
        />
      )}
      <View className={cn('ios:px-5 gap-1.5 px-4 py-4', className)} {...props} />
    </>
  );
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        'ios:font-bold text-card-foreground text-3xl font-medium leading-none tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

function CardSubtitle({ className, variant, ...props }: TextProps) {
  return (
    <Text
      variant={variant ?? Platform.select({ ios: 'footnote', default: 'body' })}
      className={cn('ios:font-semibold ios:uppercase font-medium opacity-70', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn('text-muted-foreground leading-5', className)}
      wrap={props.numberOfLines === undefined || props.numberOfLines > 1}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: BlurViewProps) {
  return (
    <BlurView
      intensity={Platform.select({ ios: 15, default: 0 })}
      className={cn('ios:px-5 ios:pt-3 flex-row items-center gap-4 px-4 pb-4 pt-0', className)}
      {...props}
    />
  );
}

type CardProps = ViewProps & { rootClassName?: string; rootStyle?: StyleProp<ViewStyle> };

export { CardContent, CardDescription, CardFooter, CardSubtitle, CardTitle };
export type { CardProps };
