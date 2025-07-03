import { Text, View } from 'react-native';
import { cn } from '~/lib/cn';
import type { WeightUnit } from '~/types';
import { formatWeight } from '~/utils/weight';

type WeightBadgeProps = {
  weight: number;
  unit: WeightUnit;
  type?: 'base' | 'total' | 'item';
};

export function WeightBadge({ weight, unit = 'g', type = 'item' }: WeightBadgeProps) {
  const getColorClass = () => {
    switch (type) {
      case 'base':
        return 'bg-blue-100 text-blue-800';
      case 'total':
        return 'bg-purple-100 text-purple-800';
      case 'item':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const safeWeight = typeof weight === 'number' ? weight : 0;
  const safeUnit = typeof unit === 'string' ? unit : 'g';
  const formattedWeight = formatWeight(safeWeight, safeUnit);

  return (
    <View className={cn('rounded-full px-2 py-1', getColorClass().split(' ')[0])}>
      <Text className={cn('text-center text-xs font-medium', getColorClass().split(' ')[1])}>
        {formattedWeight}
      </Text>
    </View>
  );
}
