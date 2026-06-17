import { Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { testIds } from 'expo-app/lib/testIds';
import * as Haptics from 'expo-haptics';
import { Pressable, TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type HorizontalCatalogItemCardProps = {
  item: CatalogItem & { similarity?: number };
} & (
  | {
      onPress: () => void;
    }
  | {
      onSelect: (item: CatalogItem) => void;
      selected: boolean;
      quantity?: number;
      onQuantityChange?: (itemId: number, delta: number) => void;
    }
);

const formatPrice = ({ price, currency }: { price?: number | null; currency?: string | null }) => {
  if (!price) return '';
  return `${currency || '$'}${price.toFixed(2)}`;
};

const formatWeight = ({ weight, unit }: { weight?: number | null; unit?: string | null }) => {
  if (!weight) return '';
  return `${parseFloat(weight.toFixed(2))}${unit || 'g'}`;
};

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

export function HorizontalCatalogItemCard({ item, ...restProps }: HorizontalCatalogItemCardProps) {
  const { colors } = useColorScheme();

  const handleCardPress = () => {
    if ('onSelect' in restProps) {
      if (!restProps.selected) {
        restProps.onSelect(item);
      }
    } else {
      restProps.onPress();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleCardPress}>
      <Animated.View
        testID={testIds.items.catalogCard(item.id)}
        layout={LinearTransition.duration(200)}
        className="rounded-lg flex-row gap-3 border border-border bg-card p-4"
      >
        {/* Image */}
        <CatalogItemImage
          imageUrl={item.images?.[0]}
          className="h-16 w-16 rounded-md"
          resizeMode="cover"
        />

        {/* Content */}
        <View className="flex-1 min-w-0">
          <Text className="font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          {item.brand && <Text className="text-sm text-muted-foreground">{item.brand}</Text>}

          <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
            {!!item.price && (
              <Text className="text-sm font-medium text-foreground">
                {formatPrice({ price: item.price, currency: item.currency })}
              </Text>
            )}
            {!!item.weight && (
              <Text className="text-sm text-muted-foreground">
                {formatWeight({ weight: item.weight, unit: item.weightUnit })}
              </Text>
            )}
            {!!item.ratingValue && (
              <View className="flex-row items-center gap-1">
                <Icon name="star" size={12} color={colors.yellow} />
                <Text className="text-sm text-muted-foreground">{item.ratingValue.toFixed(1)}</Text>
              </View>
            )}
          </View>
          {!!item.similarity && (
            <Text
              className={`text-xs font-medium mt-4 ${
                item.similarity >= 0.8
                  ? 'text-primary'
                  : item.similarity >= 0.5
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              }`}
            >
              {Math.round(item.similarity * 100)}% confident
            </Text>
          )}
        </View>

        {/* Add / quantity control */}
        {'onSelect' in restProps && (
          <View className="items-center justify-center ml-1 shrink-0">
            {restProps.selected ? (
              <Animated.View
                key="qty"
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(100)}
                className="items-center"
                style={{ gap: 2 }}
              >
                <ScalePress
                  onPress={() => restProps.onQuantityChange?.(item.id, 1)}
                  hitSlop={{ top: 10, bottom: 4, left: 10, right: 10 }}
                  className="h-6 w-6 items-center justify-center"
                >
                  <Icon name="plus" size={13} color={colors.grey2} />
                </ScalePress>
                <Text
                  className="text-xl font-bold text-foreground text-center"
                  style={{ minWidth: 28 }}
                >
                  {restProps.quantity ?? 1}
                </Text>
                <ScalePress
                  onPress={() => {
                    const qty = restProps.quantity ?? 1;
                    if (qty <= 1) {
                      restProps.onSelect(item);
                    } else {
                      restProps.onQuantityChange?.(item.id, -1);
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
                  onPress={() => restProps.onSelect(item)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  className="h-9 w-9 items-center justify-center rounded-full bg-muted/25"
                >
                  <Icon name="plus" size={18} color={colors.grey2} />
                </ScalePress>
              </Animated.View>
            )}
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
