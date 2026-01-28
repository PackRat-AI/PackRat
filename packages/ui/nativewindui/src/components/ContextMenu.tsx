import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import {
  View,
  type ViewProps,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ContextMenuRef {
  show: (x: number, y: number) => void;
  hide: () => void;
}

export interface ContextMenuProps extends ViewProps {
  /**
   * Menu items
   */
  items: ContextMenuItem[];
  /**
   * Callback when item is selected
   */
  onSelect: (item: ContextMenuItem) => void;
  /**
   * Children to wrap
   */
  children: React.ReactNode;
}

export interface ContextMenuItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  destructive?: boolean;
}

export const ContextMenu = forwardRef<ContextMenuRef, ContextMenuProps>(
  ({ items, onSelect, children, style, ...props }, ref) => {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useImperativeHandle(ref, () => ({
      show: (x: number, y: number) => {
        setPosition({ x: Math.min(x, (global as any).window?.width - 200 || 300 - 16), y });
        setVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
      hide: () => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }).start();
        setTimeout(() => setVisible(false), 100);
      },
    }));

    const handleSelect = useCallback((item: ContextMenuItem) => {
      onSelect(item);
      (ref as any)?.hide();
    }, [onSelect, ref]);

    if (!visible) return <>{children}</>;

    return (
      <>
        <Pressable
          className="absolute inset-0 bg-transparent"
          onPress={() => (ref as any)?.hide()}
        >
          <Animated.View
            className="absolute rounded-lg bg-card shadow-xl"
            style={[
              {
                left: position.x + insets.left,
                top: position.y + insets.top,
                opacity: fadeAnim,
              },
              style,
            ]}
            {...props}
          >
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                className={cn(
                  'flex-row items-center px-4 py-3',
                  item.destructive && 'bg-destructive/10',
                  index !== items.length - 1 && 'border-b border-border'
                )}
                onPress={() => handleSelect(item)}
              >
                {item.icon && <View className="mr-3">{item.icon}</View>}
                <Text
                  className={cn(
                    'text-base',
                    item.destructive ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
        {children}
      </>
    );
  }
);

ContextMenu.displayName = 'ContextMenu';
