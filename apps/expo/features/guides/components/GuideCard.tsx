import { MaterialIcons } from "@expo/vector-icons";
import { Card, CardContent, CardTitle, Text } from "@packrat/ui/nativewindui";
import { Icon } from "@roninoss/icons";
import { TouchableOpacity, View } from "react-native";
import type { Guide } from "../types";

interface GuideCardProps {
  guide: Guide;
  onPress: () => void;
}

export const GuideCard: React.FC<GuideCardProps> = ({ guide, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card className="mb-3">
        <CardContent className="p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <CardTitle className="text-lg font-semibold mb-1">
                {guide.title}
              </CardTitle>
              {guide.description && (
                <Text
                  className="text-sm text-gray-600 dark:text-gray-400 mb-2"
                  numberOfLines={2}
                >
                  {guide.description}
                </Text>
              )}
              <View className="flex-row items-center gap-2">
                <View className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  <Text className="text-xs text-gray-700 dark:text-gray-300">
                    {guide.category}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500 dark:text-gray-500">
                  {new Date(guide.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <Icon
              as={MaterialIcons}
              name="chevron-right"
              size={24}
              className="text-gray-400 dark:text-gray-600"
            />
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
};
