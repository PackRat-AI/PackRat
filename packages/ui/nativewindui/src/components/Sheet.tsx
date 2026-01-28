import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  type ModalProps,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface SheetProps extends Omit<ModalProps, 'visible'> {
  /**
   * Whether the sheet is visible
   */
  visible: boolean;
  /**
   * Callback when sheet should close
   */
  onClose: () => void;
  /**
   * Sheet snap points (percentage or pixel values)
   */
  snapPoints?: (number | string)[];
  /**
   * Initial snap point index
   */
  initialSnapIndex?: number;
  /**
   * Sheet title
   */
  title?: string;
  /**
   * Whether to show the handle bar
   */
  showHandle?: boolean;
  /**
   * Content container style
   */
  contentContainerStyle?: any;
  children: React.ReactNode;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const Sheet = forwardRef<SheetRef, SheetProps>(
  (
    {
      visible,
      onClose,
      snapPoints = ['50%', '90%'],
      initialSnapIndex = 0,
      title,
      showHandle = true,
      contentContainerStyle,
      children,
      ...props
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const animatedValue = useRef(new Animated.Value(0));
    const [currentSnap, setCurrentSnap] = useState(initialSnapIndex);

    useImperativeHandle(ref, () => ({
      present: () => {
        Animated.timing(animatedValue.current, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      },
      dismiss: () => {
        Animated.timing(animatedValue.current, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
        setTimeout(onClose, 250);
      },
    }));

    const getSnapHeight = (index: number) => {
      const snapPoint = snapPoints[index];
      if (typeof snapPoint === 'string' && snapPoint.includes('%')) {
        return (parseFloat(snapPoint) / 100) * SCREEN_HEIGHT;
      }
      return snapPoint as number;
    };

    const translateY = animatedValue.current.interpolate({
      inputRange: [0, 1],
      outputRange: [getSnapHeight(snapPoints.length - 1), 0],
    });

    if (!visible) return null;

    return (
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={onClose}
        {...props}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={onClose}
        >
          <Animated.View
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-background"
            style={[
              {
                transform: [{ translateY }],
                maxHeight: getSnapHeight(snapPoints.length - 1),
              },
              contentContainerStyle,
            ]}
          >
            {/* Handle bar */}
            {showHandle && (
              <View className="items-center py-3">
                <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </View>
            )}

            {/* Title */}
            {title && (
              <Text className="mb-4 px-6 text-lg font-semibold">{title}</Text>
            )}

            {/* Content */}
            <View className="px-6 pb-8" style={{ paddingBottom: insets.bottom + 8 }}>
              {children}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }
);

Sheet.displayName = 'Sheet';

export function useSheetRef() {
  return useRef<SheetRef>(null);
}
