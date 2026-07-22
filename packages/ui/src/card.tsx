import { cn } from 'expo-app/lib/cn';
import { BlurView, type BlurViewProps } from 'expo-blur';
import { Platform, type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';
import { Text, type TextProps } from './text';

// Plain RN composition — Card never needed a native Host bridge (it's View/BlurView/Text
// layout, no @expo/ui component), so it's ported directly rather than routed through @expo/ui.

function Card({
  className,
  rootClassName,
  rootStyle,
  ...props
}: ViewProps & { rootClassName?: string; rootStyle?: StyleProp<ViewStyle> }) {
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

function CardContent({
  className,
  iosBlurIntensity = 3,
  iosBlurClassName,
  ...props
}: ViewProps & { iosBlurIntensity?: number; iosBlurClassName?: string }) {
  return (
    <>
      {Platform.OS === 'ios' && (
        <BlurView intensity={iosBlurIntensity} className={iosBlurClassName} />
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

export { Card, CardContent, CardDescription, CardFooter, CardSubtitle, CardTitle };
