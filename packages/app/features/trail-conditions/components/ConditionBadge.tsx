import { Text } from '@packrat/ui/nativewindui';
import { cn } from 'app/lib/cn';
import { View } from 'react-native';
import type { OverallCondition } from '../types';

interface ConditionBadgeProps {
  condition: OverallCondition | string;
}

export function ConditionBadge({ condition }: ConditionBadgeProps) {
  const getColor = () => {
    switch (condition) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'fair':
        return 'bg-amber-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getLabel = () => {
    return condition.charAt(0).toUpperCase() + condition.slice(1);
  };

  return (
    <View className={cn('rounded-full px-2 py-1', getColor())}>
      <Text variant="caption2" className="font-medium text-white">
        {getLabel()}
      </Text>
    </View>
  );
}
