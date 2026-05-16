import { EvilIcons, Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Card,
  CardContent,
  Text,
  useColorScheme,
} from '@packrat/ui/nativewindui';
import type React from 'react';
import { Pressable, View } from 'react-native';

interface ToolCardProps {
  text: string;
  icon?: React.ReactElement | 'loading' | 'error' | 'info';
  onPress?: () => void;
}

export function ToolCard({ text, icon, onPress }: ToolCardProps) {
  const { colors } = useColorScheme();

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card rootClassName="border border-border rounded-xl bg-inherit shadow-none">
        <CardContent className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2 pr-2">
            {icon === 'loading' ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : icon === 'error' ? (
              <Ionicons name="alert-circle-outline" size={24} color={colors.destructive} />
            ) : icon === 'info' ? (
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            ) : (
              icon
            )}
            <Text
              variant="caption2"
              className={icon === 'loading' ? 'italic' : ''}
              numberOfLines={2}
            >
              {text}
            </Text>
          </View>
          {onPress && (
            <View className="items-center justify-center ml-4">
              <EvilIcons name="chevron-right" size={24} color={colors.foreground} />
            </View>
          )}
        </CardContent>
      </Card>
    </Pressable>
  );
}
