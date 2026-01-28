import { View, type ViewProps, StyleSheet } from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';

export interface FormProps extends ViewProps {
  children: React.ReactNode;
}

export function Form({ children, className, style, ...props }: FormProps) {
  return (
    <View className={cn('', className)} style={style} {...props}>
      {children}
    </View>
  );
}

export interface FormSectionProps extends ViewProps {
  /**
   * Section title
   */
  title?: string;
  /**
   * Section description
   */
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children, className, style, ...props }: FormSectionProps) {
  return (
    <View className={cn('mb-6', className)} style={style} {...props}>
      {title && (
        <Text className="mb-1 px-1 text-lg font-semibold">{title}</Text>
      )}
      {description && (
        <Text className="mb-3 px-1 text-sm text-muted-foreground">{description}</Text>
      )}
      <View className="rounded-lg border border-border bg-card">{children}</View>
    </View>
  );
}

export interface FormItemProps extends ViewProps {
  /**
   * Label for the form item
   */
  label?: string;
  /**
   * Whether to show the divider between items
   */
  showDivider?: boolean;
  children: React.ReactNode;
}

export function FormItem({ label, showDivider = true, children, className, style, ...props }: FormItemProps) {
  return (
    <View className={cn('', className)} style={style} {...props}>
      {label && (
        <Text className="mb-2 px-1 text-sm font-medium text-foreground">{label}</Text>
      )}
      {children}
      {showDivider && <View className="h-px bg-border" />}
    </View>
  );
}

export interface FormLabelProps extends ViewProps {
  children: React.ReactNode;
  required?: boolean;
}

export function FormLabel({ children, required, className, style, ...props }: FormLabelProps) {
  return (
    <View className={cn('mb-1', className)} style={style} {...props}>
      <Text className="text-sm font-medium text-foreground">
        {children}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
    </View>
  );
}
