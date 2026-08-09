import { Icon } from 'expo-app/components/Icon';
import type { MaterialIconName } from 'expo-app/components/Icon/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { Platform, View, type ViewProps, type ViewStyle } from 'react-native';
import { Text } from './text';

// Plain RN View composition — Form never needed a Host bridge, ported directly.

function Form({ className, ...props }: ViewProps) {
  return <View className={cn('gap-9', className)} {...props} />;
}

// Add as class when possible: https://github.com/marklawlor/nativewind/issues/522
const BORDER_CURVE: ViewStyle = { borderCurve: 'continuous' };

type FormSectionProps = ViewProps & {
  rootClassName?: string;
  footnote?: string;
  footnoteClassName?: string;
  ios?: {
    title: string;
    titleClassName?: string;
  };
  materialIconProps?: { name: MaterialIconName };
};

function FormSection({
  rootClassName,
  className,
  footnote,
  footnoteClassName,
  ios,
  materialIconProps,
  style = BORDER_CURVE,
  children: childrenProps,
  ...props
}: FormSectionProps) {
  const { colors } = useColorScheme();
  const children = React.useMemo(() => {
    if (Platform.OS !== 'ios') return childrenProps;
    const childrenArray = React.Children.toArray(childrenProps);
    return React.Children.map(childrenArray, (child, index) => {
      if (!React.isValidElement(child)) return child;
      const isLast = index === childrenArray.length - 1;
      return React.cloneElement<ViewProps & { isLast?: boolean }>(
        child as React.ReactElement<ViewProps & { isLast?: boolean }>,
        { isLast },
      );
    });
  }, [childrenProps]);

  return (
    <View
      className={cn(
        'relative',
        Platform.OS !== 'ios' && !!materialIconProps && 'flex-row gap-4',
        rootClassName,
      )}
    >
      {Platform.OS === 'ios' && !!ios?.title && (
        <Text
          variant="footnote"
          className={cn('text-muted-foreground pb-1 pl-3 uppercase', ios?.titleClassName)}
        >
          {ios.title}
        </Text>
      )}
      {!!materialIconProps && (
        <View className="ios:hidden pt-0.5">
          <Icon name={materialIconProps.name} color={colors.grey} />
        </View>
      )}
      <View className={cn(!!materialIconProps && Platform.OS === 'android' && 'flex-1')}>
        <View
          className={cn(
            'ios:overflow-hidden ios:rounded-lg ios:bg-card ios:gap-0 ios:pl-1 gap-4',
            className,
          )}
          style={style}
          {...props}
        >
          {children}
        </View>
        {!!footnote && (
          <Text
            className={cn('ios:pl-3 ios:pt-1 text-muted-foreground pl-3 pt-0.5', footnoteClassName)}
            variant="footnote"
          >
            {footnote}
          </Text>
        )}
      </View>
    </View>
  );
}

function FormItem({
  className,
  isLast,
  iosSeparatorClassName,
  ...props
}: ViewProps & {
  isLast?: boolean;
  iosSeparatorClassName?: string;
}) {
  return (
    <>
      <View className={cn('ios:pr-1', className)} {...props} />
      {Platform.OS === 'ios' && !isLast && (
        <View className={cn('bg-border ml-2 h-px w-full', iosSeparatorClassName)} />
      )}
    </>
  );
}

export { Form, FormItem, FormSection };
