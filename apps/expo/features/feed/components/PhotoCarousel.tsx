import { Text } from '@packrat/ui/src/text';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, type LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { buildPostImageUrl } from '../utils';
import { clampedPhotoAspect, PLACEHOLDER_ASPECT } from '../utils/photoAspect';

/** First-photo shapes already measured, so a post keeps its height when it scrolls back in. */
const aspectCache = new Map<string, number>();

/**
 * The photos on a post: swipe between them, tap to open full screen, double-tap to like. The
 * carousel takes the shape of the first photo, clamped between 4:5 and 1.91:1.
 */
export function PhotoCarousel({
  images,
  index,
  onIndexChange,
  onOpen,
  onDoubleTap,
}: {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onOpen: (index: number) => void;
  onDoubleTap?: () => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const first = images[0] ?? '';
  const [aspect, setAspect] = useState(aspectCache.get(first) ?? PLACEHOLDER_ASPECT);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const measureFirst = (size: { width: number; height: number }) => {
    if (aspectCache.has(first)) return;
    const ratio = clampedPhotoAspect(size.width, size.height);
    aspectCache.set(first, ratio);
    setAspect(ratio);
  };

  const height = width > 0 ? width / aspect : 0;

  const renderPhoto = ({ item, index: photoIndex }: { item: string; index: number }) => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .runOnJS(true)
      .onEnd(() => onDoubleTap?.());
    const singleTap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => onOpen(photoIndex));
    return (
      <GestureDetector gesture={Gesture.Exclusive(doubleTap, singleTap)}>
        <View
          style={{ width, height }}
          accessible
          accessibilityRole="imagebutton"
          accessibilityLabel={t('feed.photoOf', { index: photoIndex + 1, count: images.length })}
          testID={testIds.feed.photo(photoIndex)}
        >
          <Image
            source={{ uri: buildPostImageUrl(item) }}
            style={{ width, height }}
            contentFit="cover"
            transition={150}
            recyclingKey={item}
            onLoad={photoIndex === 0 ? (event) => measureFirst(event.source) : undefined}
            accessibilityIgnoresInvertColors
          />
        </View>
      </GestureDetector>
    );
  };

  return (
    <View onLayout={onLayout} className="bg-muted" style={{ height: height || undefined }}>
      {width > 0 ? (
        <FlatList
          data={images}
          keyExtractor={(item, i) => `${i}-${item}`}
          renderItem={renderPhoto}
          horizontal
          pagingEnabled
          scrollEnabled={images.length > 1}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(event) =>
            onIndexChange(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        />
      ) : null}
      {images.length > 1 ? (
        <>
          <View
            className="absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1"
            importantForAccessibility="no-hide-descendants"
          >
            <Text variant="caption1" className="font-semibold text-white">
              {t('feed.photoCounter', { index: index + 1, count: images.length })}
            </Text>
          </View>
          <View
            className="absolute bottom-2.5 flex-row gap-1.5 self-center rounded-full bg-black/25 px-2 py-1.5"
            importantForAccessibility="no-hide-descendants"
            testID={testIds.feed.photoPageDots}
          >
            {images.map((image, i) => (
              <View
                key={`${i}-${image}`}
                className="rounded-full bg-white"
                style={{
                  width: i === index ? 7 : 6,
                  height: i === index ? 7 : 6,
                  opacity: i === index ? 1 : 0.5,
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
