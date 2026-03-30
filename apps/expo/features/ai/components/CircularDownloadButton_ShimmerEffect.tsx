import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Arrow-down path in a 24×24 viewBox
const ARROW_PATH = 'M12 4 L12 20 M5 13 L12 20 L19 13';
const SVG_SIZE = 24;
const SHIMMER_BAND = 4; // half-height of the highlight band in SVG units

type Props = {
  progress: number;
  isDownloading: boolean;
  onDownload: () => void;
  size?: number;
  strokeWidth?: number;
};

function ArrowSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
      <Path
        d={ARROW_PATH}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CircularDownloadButton({
  progress,
  isDownloading,
  onDownload,
  size = 44,
  strokeWidth = 4,
}: Props) {
  const { colors } = useColorScheme();
  const HALF = size / 2;
  const innerSize = size - strokeWidth * 2;
  const innerRadius = innerSize / 2;
  const iconSize = size * 0.45;

  // Shimmer sweeps from above the arrow to below
  const shimmerPos = useSharedValue(-SHIMMER_BAND);

  React.useEffect(() => {
    if (isDownloading) {
      shimmerPos.value = -SHIMMER_BAND;
      shimmerPos.value = withRepeat(
        withTiming(SVG_SIZE + SHIMMER_BAND, {
          duration: 1200,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(shimmerPos);
      shimmerPos.value = -SHIMMER_BAND;
    }
  }, [isDownloading, shimmerPos]);

  // y1/y2 define the gradient band position in SVG user space
  const gradientId = React.useId().replace(/:/g, '');

  const gradientProps = useAnimatedProps(() => ({
    y1: shimmerPos.value - SHIMMER_BAND,
    y2: shimmerPos.value + SHIMMER_BAND,
  }));

  // Rotation angles for the two D-shape halves
  const r1 = isDownloading ? (progress <= 50 ? 180 + (progress / 50) * 180 : 0) : 180;
  const r2 = isDownloading ? (progress > 50 ? 180 - ((progress - 50) / 50) * 180 : 180) : 180;

  const handlePress = () => {
    if (isDownloading) return;
    onDownload();
  };

  return (
    <TouchableOpacity
      disabled={isDownloading}
      onPress={handlePress}
      style={{ width: size, height: size }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {isDownloading ? (
        // ── Circular progress ring ──────────────────────────────────────
        <View style={{ width: size, height: size }}>
          {/* Track (full circle background) */}
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: HALF,
              backgroundColor: colors.grey2,
              opacity: 0.3,
            }}
          />

          {/* Right-half fill (0→50%) */}
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: HALF,
              height: size,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: HALF,
                height: size,
                borderTopRightRadius: HALF,
                borderBottomRightRadius: HALF,
                backgroundColor: colors.primary,
                transform: [
                  { translateX: -(HALF / 2) },
                  { rotate: `${r1}deg` },
                  { translateX: HALF / 2 },
                ],
              }}
            />
          </View>

          {/* Left-half fill (50→100%) */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: HALF,
              height: size,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: HALF,
                height: size,
                borderTopLeftRadius: HALF,
                borderBottomLeftRadius: HALF,
                backgroundColor: colors.primary,
                transform: [
                  { translateX: HALF / 2 },
                  { rotate: `${r2}deg` },
                  { translateX: -(HALF / 2) },
                ],
              }}
            />
          </View>

          {/* Inner hole — shimmer arrow */}
          <View
            style={{
              position: 'absolute',
              top: strokeWidth,
              left: strokeWidth,
              width: innerSize,
              height: innerSize,
              borderRadius: innerRadius,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={iconSize} height={iconSize} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
              <Defs>
                {/* Gradient band position is animated top-to-bottom in SVG user space */}
                <AnimatedLinearGradient
                  id={gradientId}
                  x1="12"
                  x2="12"
                  gradientUnits="userSpaceOnUse"
                  animatedProps={gradientProps}
                >
                  <Stop offset="0" stopColor={colors.grey} />
                  <Stop offset="0.5" stopColor="white" stopOpacity={0.9} />
                  <Stop offset="1" stopColor={colors.grey} />
                </AnimatedLinearGradient>
              </Defs>
              <Path
                d={ARROW_PATH}
                stroke={`url(#${gradientId})`}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
        </View>
      ) : (
        // ── Download icon button ────────────────────────────────────────
        <View
          style={{
            width: size,
            height: size,
            borderRadius: HALF,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowSvg size={size * 0.45} color={colors.grey} />
        </View>
      )}
    </TouchableOpacity>
  );
}
