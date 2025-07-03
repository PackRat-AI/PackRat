import { Text, View } from 'react-native';
import type { PackCategory } from '~/types';

type CategoryBadgeProps = {
  category: PackCategory | string;
};

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const getColorClass = () => {
    switch (category) {
      case 'hiking':
        return 'bg-green-100 text-green-800';
      case 'backpacking':
        return 'bg-blue-100 text-blue-800';
      case 'camping':
        return 'bg-yellow-100 text-yellow-800';
      case 'climbing':
        return 'bg-red-100 text-red-800';
      case 'winter':
        return 'bg-cyan-100 text-cyan-800';
      case 'desert':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className={`rounded-full px-2 py-1 ${getColorClass().split(' ')[0]}`}>
      <Text className={`text-xs font-medium ${getColorClass().split(' ')[1]} capitalize`}>
        {category}
      </Text>
    </View>
  );
}
