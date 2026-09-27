import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';
import { capitalizeFirst, conditionDisplay } from '../lib/display';
import type { OverallCondition } from '../types';

interface ConditionBadgeProps {
  condition: OverallCondition | string;
  /** `lg` is the detail screen's stacked card; `sm` is the inline capsule used in list rows. */
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * The condition capsule from `TrailReportRow.conditionBadge` in `TrailConditionsView.swift`:
 * icon + label, tinted by condition, on a translucent fill of the same hue.
 */
export function ConditionBadge({ condition, size = 'sm', className }: ConditionBadgeProps) {
  const { colors } = useColorScheme();
  const display = conditionDisplay(condition);
  const isLarge = size === 'lg';

  // The icon takes a colour value rather than a class, so the display map names which theme
  // token each state uses and the value is resolved here.
  const iconColor = display.iconColor(colors);

  if (isLarge) {
    return (
      <View
        className={cn(
          'items-center justify-center gap-1 rounded-xl px-4 py-3',
          display.backgroundClassName,
          className,
        )}
      >
        <Icon name={display.icon} size={24} color={iconColor} />
        <Text variant="caption2" className={cn('font-bold', display.textClassName)}>
          {capitalizeFirst(condition)}
        </Text>
      </View>
    );
  }

  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full px-2 py-1',
        display.backgroundClassName,
        className,
      )}
    >
      <Icon name={display.icon} size={13} color={iconColor} />
      <Text variant="caption2" className={cn('font-bold', display.textClassName)}>
        {capitalizeFirst(condition)}
      </Text>
    </View>
  );
}
