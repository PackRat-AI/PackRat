import { View, type ViewProps, Image, StyleSheet } from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';

export interface AvatarProps extends ViewProps {
  /**
   * Avatar size
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Image source
   */
  source?: { uri: string } | number;
  /**
   * Fallback content (initials or icon)
   */
  fallback?: React.ReactNode;
  /**
   * Whether to show a border
   */
  showBorder?: boolean;
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export function Avatar({
  size = 'md',
  source,
  fallback,
  showBorder = false,
  className,
  style,
  ...props
}: AvatarProps) {
  const sizeValue = sizeMap[size];

  return (
    <View
      className={cn(
        'items-center justify-center overflow-hidden rounded-full bg-muted',
        showBorder && 'border-2 border-background',
        className
      )}
      style={[{ width: sizeValue, height: sizeValue }, style]}
      {...props}
    >
      {source ? (
        <Image
          source={typeof source === 'number' ? source : { uri: source.uri }}
          style={{ width: sizeValue, height: sizeValue }}
          resizeMode="cover"
        />
      ) : fallback ? (
        fallback
      ) : (
        <Text className="text-sm font-medium text-muted-foreground">?</Text>
      )}
    </View>
  );
}

export function AvatarFallback({ children, className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn('items-center justify-center bg-muted', className)}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}

export function AvatarImage({ source, className, style, ...props }: any) {
  return (
    <Image
      source={typeof source === 'number' ? source : { uri: source?.uri }}
      className={cn('h-full w-full', className)}
      style={style}
      {...props}
    />
  );
}
