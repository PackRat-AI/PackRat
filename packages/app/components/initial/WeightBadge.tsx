import { cn } from 'expo-app/lib/cn';
import type { WeightUnit } from 'expo-app/types';
import { formatWeight } from 'expo-app/utils/weight';
import { Text, View } from 'react-native';

type WeightBadgeProps = {
  weight: number;
  unit: WeightUnit;
  type?: 'base' | 'total' | 'item';
  containerClassName?: string;
  textClassName?: string;
};

export function WeightBadge({
  weight,
  unit = 'g',
  type = 'item',
  containerClassName,
  textClassName,
}: WeightBadgeProps) {
  const getColorClass = () => {
    switch (type) {
      case 'base':
        return ['bg-blue-100', 'text-blue-800'];
      case 'total':
        return ['bg-purple-100', 'text-purple-800'];
      default:
        return ['bg-muted dark:bg-neutral-700', 'dark:text-neutral-200'];
    }
  };

  const safeWeight = Number(weight) || 0;
  const safeUnit = typeof unit === 'string' ? unit : 'g';
  const formattedWeight = formatWeight(safeWeight, safeUnit);

  return (
    <View className={cn('rounded-full px-2 py-1', getColorClass()[0], containerClassName)}>
      <Text className={cn('text-center text-xs font-medium', getColorClass()[1], textClassName)}>
        {formattedWeight}
      </Text>
    </View>
  );
}
