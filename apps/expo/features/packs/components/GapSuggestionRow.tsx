import { Text } from '@packrat/ui/nativewindui';
import MaskedView from '@react-native-masked-view/masked-view';
import { Icon } from 'expo-app/components/Icon';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
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
    translateX.value = withRepeat(withTiming(400, { duration: 2200, easing: Easing.linear }), -1);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const highlight = isDarkColorScheme
    ? (['transparent', 'rgba(255,255,255,0.65)', 'transparent'] as const)
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
  showControls: boolean;
  onSelect: (item: CatalogItem) => void;
  onDeselect: () => void;
  onQuantityChange: (delta: number) => void;
  onSwapPress: () => void;
  onControlsOpen: () => void;
  onControlsDismiss: () => void;
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
  showControls,
  onSelect,
  onDeselect,
  onQuantityChange,
  onSwapPress,
  onControlsOpen,
  onControlsDismiss,
  selectedItem,
}: GapSuggestionRowProps) {
  const { isDarkColorScheme, colors } = useColorScheme();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drives the pill morph: 0 = compact (qty only), 1 = full (+/− controls)
  const controlsProgress = useSharedValue(showControls ? 1 : 0);

  useEffect(() => {
    controlsProgress.value = withTiming(showControls ? 1 : 0, {
      duration: showControls ? 200 : 220,
      easing: showControls ? Easing.out(Easing.back(1.1)) : Easing.in(Easing.quad),
    });
  }, [showControls]);

  // Icon slots grow from 0 → 28 and fade in after pill is half-open
  const iconWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(controlsProgress.value, [0, 1], [0, 28]),
    opacity: interpolate(controlsProgress.value, [0, 0.5, 1], [0, 0, 1]),
  }));

  // Pill padding breathes slightly wider when controls are open
  const pillPaddingStyle = useAnimatedStyle(() => ({
    paddingHorizontal: interpolate(controlsProgress.value, [0, 1], [8, 10]),
  }));

  useEffect(() => {
    if (!selected && dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
  }, [selected]);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const scheduleDismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => onControlsDismiss(), 2500);
  };

  const handleAdd = (item: CatalogItem) => {
    onSelect(item);
    onControlsOpen();
    scheduleDismiss();
  };

  const handleIncrement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onControlsOpen();
    onQuantityChange(1);
    scheduleDismiss();
  };

  const handleDecrement = () => {
    if (quantity <= 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDeselect();
      onControlsDismiss();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onControlsOpen();
      onQuantityChange(-1);
      scheduleDismiss();
    }
  };

  const handleQtyPillPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onControlsOpen();
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
    <View className="mb-3 rounded-lg bg-card overflow-hidden">
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

      <View className={`mx-3 mb-3 rounded-lg ${isLoadingMatch ? 'bg-card' : 'bg-background'}`}>
        <View className="px-3 py-3 flex-row items-center gap-3" style={{ minHeight: 56 }}>
          {isLoadingMatch ? (
            <ShimmerFindingText suggestion={gap.suggestion} />
          ) : displayItem ? (
            <>
              {/* Item info — non-tappable; swap via the Swap button */}
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <CatalogItemImage
                  imageUrl={displayItem.images?.[0]}
                  className="h-10 w-10 rounded-md shrink-0"
                  resizeMode="cover"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                    {displayItem.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">{formatMeta(displayItem)}</Text>
                </View>
              </View>

              {/* Right side: base row always rendered; overlay morphs in on top */}
              <View
                style={{
                  width: 104,
                  minHeight: 34,
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* Base row — always in flow */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ScalePress
                    onPress={onSwapPress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: colors.grey,
                      }}
                    >
                      Swap
                    </Text>
                  </ScalePress>

                  {selected ? (
                    <Animated.View
                      key="compact-pill"
                      entering={FadeIn.duration(180)}
                      exiting={FadeOut.duration(120)}
                    >
                      <ScalePress
                        onPress={handleQtyPillPress}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 10 }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.primary,
                            borderRadius: 100,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            minWidth: 30,
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
                    <Animated.View
                      key="add"
                      entering={FadeIn.duration(180)}
                      exiting={FadeOut.duration(120)}
                    >
                      <ScalePress
                        onPress={() => displayItem && handleAdd(displayItem)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 10 }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: colors.primary,
                          }}
                        >
                          Add
                        </Text>
                      </ScalePress>
                    </Animated.View>
                  )}
                </View>

                {/* Morphing expanded pill — covers base row while controls are open.
                  No Pressable wrapper; minus/qty/plus are sibling Pressables inside. */}
                {selected && showControls && (
                  <Animated.View
                    key="expanded-pill"
                    entering={FadeIn.duration(120)}
                    exiting={FadeOut.duration(180)}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'flex-end',
                      zIndex: 10,
                      backgroundColor: colors.background,
                    }}
                  >
                    <Animated.View
                      style={[
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.primary,
                          borderRadius: 100,
                          paddingVertical: 8,
                        },
                        pillPaddingStyle,
                      ]}
                    >
                      {/* Minus — grows from left outer edge inward */}
                      <Animated.View
                        style={[{ overflow: 'hidden', alignItems: 'flex-start' }, iconWrapStyle]}
                      >
                        <Pressable
                          onPress={handleDecrement}
                          hitSlop={{ top: 20, bottom: 20, left: 20, right: 8 }}
                        >
                          <Icon name="minus" size={12} color="#fff" />
                        </Pressable>
                      </Animated.View>

                      {/* Qty — tappable to reset dismiss timer */}
                      <Pressable
                        onPress={handleQtyPillPress}
                        hitSlop={{ top: 20, bottom: 20, left: 12, right: 12 }}
                      >
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
                      </Pressable>

                      {/* Plus — grows from right outer edge inward */}
                      <Animated.View
                        style={[{ overflow: 'hidden', alignItems: 'flex-end' }, iconWrapStyle]}
                      >
                        <Pressable
                          onPress={handleIncrement}
                          hitSlop={{ top: 20, bottom: 20, left: 8, right: 20 }}
                        >
                          <Icon name="plus" size={12} color="#fff" />
                        </Pressable>
                      </Animated.View>
                    </Animated.View>
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
    </View>
  );
}
