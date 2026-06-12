import { Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { Pressable, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { GapAnalysisItem } from '../hooks/usePackGapAnalysis';

interface GapSuggestionRowProps {
  gap: GapAnalysisItem;
  topMatch: CatalogItem | undefined;
  isLoadingMatch: boolean;
  selected: boolean;
  quantity: number;
  onSelect: (item: CatalogItem) => void;
  onDeselect: () => void;
  onQuantityChange: (delta: number) => void;
  onSwapPress: () => void;
  selectedItem: CatalogItem | undefined;
}

function ScalePress({
  onPress,
  hitSlop,
  className,
  children,
}: {
  onPress: () => void;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
  className?: string;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withTiming(0.82, { duration: 80, easing: Easing.out(Easing.quad) });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
      }}
      onPress={onPress}
      hitSlop={hitSlop}
    >
      <Animated.View style={animStyle} className={className}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const PRIORITY_CONFIGS = Object.freeze({
  'must-have': {
    label: 'Must-Have',
    ios: { name: 'exclamationmark.triangle.fill' as const },
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'alert-circle' as const },
  },
  'nice-to-have': {
    label: 'Nice-to-Have',
    ios: { name: 'star.fill' as const },
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'star' as const },
  },
  optional: {
    label: 'Optional',
    ios: { name: 'circle.fill' as const },
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'circle' as const },
  },
} as const);

export function GapSuggestionRow({
  gap,
  topMatch,
  isLoadingMatch,
  selected,
  quantity,
  onSelect,
  onDeselect,
  onQuantityChange,
  onSwapPress,
  selectedItem,
}: GapSuggestionRowProps) {
  const { isDarkColorScheme, colors } = useColorScheme();

  const priorityColor =
    gap.priority === 'must-have'
      ? isDarkColorScheme
        ? '#ef4444'
        : colors.destructive
      : gap.priority === 'nice-to-have'
        ? colors.yellow
        : colors.primary;

  const priorityConfig = gap.priority ? PRIORITY_CONFIGS[gap.priority] : null;

  const displayItem = selectedItem ?? topMatch;

  const formatMeta = (item: CatalogItem) => {
    const parts: string[] = [];
    if (item.price) parts.push(`$${item.price.toFixed(2)}`);
    if (item.weight) parts.push(`${item.weight}${item.weightUnit ?? 'g'}`);
    if (item.ratingValue) parts.push(`★${item.ratingValue.toFixed(1)}`);
    return parts.join('  ');
  };

  return (
    <View className="mb-3 rounded-lg border border-border bg-card overflow-hidden">
      {/* Gap info */}
      <View className="p-4 pb-3">
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            {priorityConfig && (
              <View className="mb-1.5 flex-row items-center gap-1.5 self-start rounded-full border border-border px-2 py-0.5">
                <Icon
                  ios={priorityConfig.ios}
                  materialIcon={priorityConfig.materialIcon}
                  size={11}
                  color={priorityColor}
                />
                <Text className="text-xs font-medium" style={{ color: priorityColor }}>
                  {priorityConfig.label}
                </Text>
              </View>
            )}
            <Text className="font-semibold text-foreground">{gap.suggestion}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
              {gap.reason}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View className="h-px bg-border mx-4" />

      {/* Catalog match row */}
      <View className="px-4 py-3 flex-row items-center gap-3">
        {isLoadingMatch ? (
          <>
            <View className="h-10 w-10 rounded-md bg-muted animate-pulse" />
            <View className="flex-1 gap-1.5">
              <View className="h-3 w-32 rounded bg-muted animate-pulse" />
              <View className="h-2.5 w-20 rounded bg-muted animate-pulse" />
            </View>
          </>
        ) : displayItem ? (
          <>
            <CatalogItemImage
              imageUrl={displayItem.images?.[0]}
              className="h-10 w-10 rounded-md"
              resizeMode="cover"
            />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                {displayItem.name}
              </Text>
              <Text className="text-xs text-muted-foreground">{formatMeta(displayItem)}</Text>
            </View>

            {/* Swap link */}
            <TouchableOpacity
              onPress={onSwapPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-xs font-medium text-primary">Swap</Text>
            </TouchableOpacity>

            {/* Select / qty control */}
            <View className="items-center justify-center ml-1">
              {selected ? (
                <Animated.View
                  key="qty"
                  entering={FadeIn.duration(160)}
                  exiting={FadeOut.duration(100)}
                  className="items-center"
                  style={{ gap: 2 }}
                >
                  <ScalePress
                    onPress={() => onQuantityChange(1)}
                    hitSlop={{ top: 10, bottom: 4, left: 10, right: 10 }}
                    className="h-6 w-6 items-center justify-center"
                  >
                    <Icon name="plus" size={13} color={colors.grey2} />
                  </ScalePress>
                  <Text
                    className="text-xl font-bold text-foreground text-center"
                    style={{ minWidth: 28 }}
                  >
                    {quantity}
                  </Text>
                  <ScalePress
                    onPress={() => {
                      if (quantity <= 1) {
                        onDeselect();
                      } else {
                        onQuantityChange(-1);
                      }
                    }}
                    hitSlop={{ top: 4, bottom: 10, left: 10, right: 10 }}
                    className="h-6 w-6 items-center justify-center"
                  >
                    <Icon name="minus" size={13} color={colors.grey2} />
                  </ScalePress>
                </Animated.View>
              ) : (
                <Animated.View
                  key="add"
                  entering={FadeIn.duration(160)}
                  exiting={FadeOut.duration(100)}
                >
                  <ScalePress
                    onPress={() => onSelect(displayItem)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    className="h-9 w-9 items-center justify-center rounded-full bg-muted/25"
                  >
                    <Icon name="plus" size={18} color={colors.grey2} />
                  </ScalePress>
                </Animated.View>
              )}
            </View>
          </>
        ) : (
          <Text className="text-xs text-muted-foreground italic">
            No gear found for this suggestion
          </Text>
        )}
      </View>
    </View>
  );
}
