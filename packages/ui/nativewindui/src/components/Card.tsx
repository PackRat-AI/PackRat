import { View, type ViewProps, StyleSheet } from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';

export interface ViewPropsExtended extends ViewProps {
  /**
   * Optional className for additional styling
   */
  className?: string;
}

export function ViewExtended({ className, style, ...props }: ViewPropsExtended) {
  return <View className={cn('', className)} style={style} {...props} />;
}

export function Card({ className, style, children, ...props }: ViewPropsExtended) {
  return (
    <View
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardContent({ className, style, children, ...props }: ViewPropsExtended) {
  return (
    <View className={cn('pt-2', className)} style={style} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({ className, style, children, ...props }: ViewPropsExtended) {
  return (
    <View className={cn('mb-1', className)} style={style} {...props}>
      {children}
    </View>
  );
}

export function CardSubtitle({ className, style, children, ...props }: ViewPropsExtended) {
  return (
    <View className={cn('mb-1', className)} style={style} {...props}>
      <Text className="text-sm text-muted-foreground">{children}</Text>
    </View>
  );
}

export function CardDescription({ className, style, children, ...props }: ViewPropsExtended) {
  return (
    <View className={cn('mt-2', className)} style={style} {...props}>
      <Text className="text-sm text-muted-foreground">{children}</Text>
    </View>
  );
}

export function CardFooter({ className, style, children, ...props }: ViewPropsExtended) {
  return (
    <View className={cn('mt-4 flex-row items-center justify-end gap-2', className)} style={style} {...props}>
      {children}
    </View>
  );
}
