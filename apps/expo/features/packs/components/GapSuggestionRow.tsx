import { Text } from '@packrat/ui/nativewindui';
import MaskedView from '@react-native-masked-view/masked-view';
import { Icon } from 'expo-app/components/Icon';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { GapAnalysisItem } from '../hooks/usePackGapAnalysis';

const SHIMMER_STRIP = 120;

function ShimmerFindingText({ suggestion }: { suggestion: string }) {
  const { isDarkColorScheme } = useColorScheme();
  const text = `Finding "${suggestion}" from catalog…`;
  const translateX = useSharedValue(-SHIMMER_STRIP);

  useEffect(() => {
    translateX.value = withRepeat(withTiming(400, { duration: 1100, easing: Easing.linear }), -1);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const highlight = isDarkColorScheme
    ? (['transparent', 'rgba(255,255,255,0.25)', 'transparent'] as const)
    : (['transparent', 'rgba(255,255,255,0.85)', 'transparent'] as const);

  return (
    <MaskedView
      style={{ flex: 1 }}
      maskElement={
        <Text style={{ fontSize: 12, fontStyle: 'italic' }} className="text-foreground">
          {text}
        </Text>
      }
    >
      <Text style={{ fontSize: 12, fontStyle: 'italic' }} className="text-muted-foreground">
        {text}
      </Text>
      <Animated.View
        style={[shimmerStyle, { position: 'absolute', top: 0, bottom: 0, width: SHIMMER_STRIP }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={highlight}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </MaskedView>
  );
}

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
  'must-have': { label: 'Must-Have' },
  'nice-to-have': { label: 'Nice-to-Have' },
  optional: { label: 'Optional' },
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
  const [showControls, setShowControls] = useState(false);
  const [addWidth, setAddWidth] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset controls when item is deselected externally
  useEffect(() => {
    if (!selected) {
      setShowControls(false);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    }
  }, [selected]);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const scheduleDismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setShowControls(false), 1500);
  };

  const handleAdd = (item: CatalogItem) => {
    onSelect(item);
    setShowControls(true);
    scheduleDismiss();
  };

  const handleIncrement = () => {
    onQuantityChange(1);
    scheduleDismiss();
  };

  const handleDecrement = () => {
    if (quantity <= 1) {
      onDeselect();
      setShowControls(false);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    } else {
      onQuantityChange(-1);
      scheduleDismiss();
    }
  };

  const handleQtyPillPress = () => {
    setShowControls(true);
    scheduleDismiss();
  };

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
              <Text className="mb-1 text-xs font-semibold" style={{ color: priorityColor }}>
                {priorityConfig.label}
              </Text>
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
      <View className="px-4 py-3 flex-row items-center gap-3" style={{ minHeight: 64 }}>
        {isLoadingMatch ? (
          <ShimmerFindingText suggestion={gap.suggestion} />
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

            {/* Swap + Add / transient controls / qty pill */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Swap — hidden while controls are open */}
              {!(selected && showControls) && (
                <TouchableOpacity
                  onPress={onSwapPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-xs font-medium text-muted-foreground">Swap</Text>
                </TouchableOpacity>
              )}

              {selected && showControls ? (
                /* Transient qty controls — auto-dismisses after 1.5 s of inactivity */
                <Animated.View
                  key="controls"
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.primary,
                    borderRadius: 100,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    gap: 10,
                  }}
                >
                  <ScalePress
                    onPress={handleDecrement}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 4 }}
                  >
                    <Icon name="minus" size={12} color="#fff" />
                  </ScalePress>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: '#fff',
                      minWidth: 16,
                      textAlign: 'center',
                      lineHeight: 16,
                    }}
                  >
                    {quantity}
                  </Text>
                  <ScalePress
                    onPress={handleIncrement}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
                  >
                    <Icon name="plus" size={12} color="#fff" />
                  </ScalePress>
                </Animated.View>
              ) : selected ? (
                /* Qty pill — tappable to reopen controls; min-width anchored to "Add" */
                <Animated.View
                  key="qty-pill"
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                >
                  <ScalePress
                    onPress={handleQtyPillPress}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  >
                    <View
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 100,
                        minWidth: addWidth || 32,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: '#fff',
                          lineHeight: 16,
                        }}
                      >
                        {quantity}
                      </Text>
                    </View>
                  </ScalePress>
                </Animated.View>
              ) : (
                /* "Add" plain text — captures its layout width for the pill's minWidth */
                <Animated.View
                  key="add"
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(120)}
                >
                  <ScalePress
                    onPress={() => displayItem && handleAdd(displayItem)}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  >
                    <Text
                      onLayout={(e) => {
                        if (addWidth === 0) setAddWidth(e.nativeEvent.layout.width);
                      }}
                      style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}
                    >
                      Add
                    </Text>
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
