import { Icon } from 'expo-app/components/Icon';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
};

function ZoomablePage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const source = { uri, headers: HEADERS };

  if (Platform.OS === 'ios') {
    return (
      <ScrollView
        style={{ width, height }}
        contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bouncesZoom
      >
        <Image source={source} style={{ width, height }} resizeMode="contain" />
      </ScrollView>
    );
  }

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={source} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

type Props = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

export function ImageViewerModal({ visible, images, initialIndex = 0, onClose }: Props) {
  const { width, height } = Dimensions.get('window');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems[0]?.index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: width, offset: width * index, index }),
    [width],
  );

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          renderItem={({ item: uri }) => <ZoomablePage uri={uri} width={width} height={height} />}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialIndex}
          removeClippedSubviews
        />

        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 52,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Dot indicator */}
        {images.length > 1 && (
          <View
            style={{
              position: 'absolute',
              bottom: 44,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 6,
                  width: i === currentIndex ? 20 : 6,
                  borderRadius: 3,
                  backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}
