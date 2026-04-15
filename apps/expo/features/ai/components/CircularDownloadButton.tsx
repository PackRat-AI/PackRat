import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { TouchableOpacity, View } from 'react-native';

type Props = {
  progress: number;
  isDownloading: boolean;
  onDownload: () => void;
  onCancel?: () => void;
  size?: number;
  strokeWidth?: number;
};

export function CircularDownloadButton({
  progress,
  isDownloading,
  onDownload,
  onCancel,
  size = 44,
  strokeWidth = 4,
}: Props) {
  const { colors } = useColorScheme();
  const HALF = size / 2;
  const innerSize = size - strokeWidth * 2;
  const innerRadius = innerSize / 2;

  // Rotation angles for the two D-shape halves.
  // r1: right half — sweeps progress 0→50%
  //   180° (hidden) → 360°/0° (fully shown), rotating CW so fill enters from 12 o'clock
  // r2: left half  — sweeps progress 50→100%
  //   180° (hidden) → 0° (fully shown), continuing CW through 9 o'clock to 12
  const r1 = isDownloading ? (progress <= 50 ? 180 + (progress / 50) * 180 : 0) : 180;
  const r2 = isDownloading ? (progress > 50 ? 180 - ((progress - 50) / 50) * 180 : 180) : 180;

  const handlePress = () => {
    if (isDownloading) {
      onCancel?.();
      return;
    }
    onDownload();
  };

  return (
    <TouchableOpacity
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

          {/* Right-half fill (0→50%): D-shape rotates around its left-edge center */}
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

          {/* Left-half fill (50→100%): D-shape rotates around its right-edge center */}
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

          {/* Inner hole — creates donut ring, contains stop icon */}
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
            <Icon name="stop" size={innerSize * 0.42} color={colors.primary} />
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
          <Icon name="arrow-down" size={size * 0.45} color={colors.card} />
        </View>
      )}
    </TouchableOpacity>
  );
}
