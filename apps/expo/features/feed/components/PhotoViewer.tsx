import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { FlatList, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildPostImageUrl } from '../utils';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;

/** One photo that pinches up to 4x, pans while zoomed, and double-taps between fit and 2.5x. */
function ZoomablePhoto({
  uri,
  width,
  height,
  zoomed,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  zoomed: boolean;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    x.value = withSpring(0);
    y.value = withSpring(0);
    savedX.value = 0;
    savedY.value = 0;
    runOnJS(onZoomChange)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 1), MAX_ZOOM);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) reset();
      else runOnJS(onZoomChange)(true);
    });

  // Only while zoomed, so an unzoomed swipe still pages.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      x.value = savedX.value + event.translationX;
      y.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
      } else {
        scale.value = withSpring(DOUBLE_TAP_ZOOM);
        savedScale.value = DOUBLE_TAP_ZOOM;
        runOnJS(onZoomChange)(true);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[{ width, height }, style]}>
        <Image
          source={{ uri: buildPostImageUrl(uri) }}
          style={{ width, height }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </GestureDetector>
  );
}

/** Full-screen photo viewer with paging and pinch to zoom. */
export function PhotoViewer({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex ?? 0);
  const [zoomed, setZoomed] = useState(false);

  return (
    <Modal
      visible={startIndex !== null}
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setIndex(startIndex ?? 0)}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
        <StatusBar hidden />
        <View className="flex-1" testID={testIds.feed.photoViewer}>
          <FlatList
            data={images}
            keyExtractor={(item, i) => `${i}-${item}`}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed && images.length > 1}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={startIndex ?? 0}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(event) =>
              setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
            }
            renderItem={({ item }) => (
              <View style={{ width, height }} className="items-center justify-center">
                <ZoomablePhoto
                  uri={item}
                  width={width}
                  height={height}
                  zoomed={zoomed}
                  onZoomChange={setZoomed}
                />
              </View>
            )}
          />
          <View
            className="absolute left-0 right-0 flex-row items-center px-2"
            style={{ top: insets.top + 8 }}
          >
            <Pressable
              onPress={onClose}
              className="h-12 w-12 items-center justify-center rounded-full bg-white/20"
              accessibilityRole="button"
              accessibilityLabel={t('feed.close')}
              android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true }}
              testID={testIds.feed.photoViewerClose}
            >
              <Icon name="close" size={24} color="white" />
            </Pressable>
            {images.length > 1 ? (
              <Text className="flex-1 pr-12 text-center font-semibold text-white">
                {t('feed.viewerCounter', { index: index + 1, count: images.length })}
              </Text>
            ) : null}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
