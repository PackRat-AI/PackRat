import { Badge, Text } from '@packrat/ui/nativewindui';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconProps } from '@roninoss/icons';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { Tabs } from 'expo-router';
import type * as React from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors } = useColorScheme();
  return (
    <>
      <Tabs
        tabBar={TAB_BAR}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
        }}
      >
        <Tabs.Screen name="(home)" options={INDEX_OPTIONS} />
        <Tabs.Screen name="packs" options={PACK_LIST_OPTIONS} />
        <Tabs.Screen name="catalog" options={ITEMS_CATALOG_OPTIONS} />
        <Tabs.Screen name="profile" options={PROFILE_OPTIONS} />
        <Tabs.Screen
          name="sqlite-debug"
          options={clientEnvs.NODE_ENV === 'development' ? {} : { href: null }}
        />
      </Tabs>
    </>
  );
}

const INDEX_OPTIONS = {
  title: 'Dashboard',
} as const;

const PACK_LIST_OPTIONS = {
  title: 'Packs',
} as const;

const ITEMS_CATALOG_OPTIONS = {
  title: 'Catalog',
} as const;

const PROFILE_OPTIONS = {
  title: 'Profile',
} as const;

const TAB_BAR = Platform.select({
  ios: undefined,
  android: (props: BottomTabBarProps) => <MaterialTabBar {...props} />,
});

const TAB_ICON = {
  '(home)': 'home',
  packs: 'backpack',
  catalog: 'clipboard-list',
  profile: 'account-circle',
} as const;

function MaterialTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingBottom: insets.bottom + 12,
      }}
      className="border-t-border/25 flex-row border-t bg-card pb-4 pt-3 dark:border-t-0"
    >
      {state.routes.map((route, index) => {
        assertDefined(descriptors[route.key]);
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <MaterialTabItem
            key={route.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            name={TAB_ICON[route.name as keyof typeof TAB_ICON]}
            isFocused={isFocused}
            badge={options.tabBarBadge}
            label={
              typeof label === 'function'
                ? label({
                    focused: isFocused,
                    color: isFocused ? colors.foreground : colors.grey2,
                    children: options.title ?? route.name ?? '',
                    position: options.tabBarLabelPosition ?? 'below-icon',
                  })
                : label
            }
            tabBarItemStyle={options.tabBarItemStyle}
          />
        );
      })}
    </View>
  );
}

function MaterialTabItem({
  isFocused,
  name = 'star',
  badge,
  className,
  label,
  tabBarItemStyle,
  ...pressableProps
}: {
  isFocused: boolean;
  name: IconProps<'material'>['name'];
  label: string | React.ReactNode;
  tabBarItemStyle?: StyleProp<ViewStyle>;
  badge?: number | string;
} & Omit<PressableProps, 'children'>) {
  const { colors } = useColorScheme();
  const isFocusedDerived = useDerivedValue(() => isFocused);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      transform: [
        {
          scaleX: withTiming(isFocusedDerived.value ? 1 : 0, { duration: 200 }),
        },
      ],
      opacity: withTiming(isFocusedDerived.value ? 1 : 0, { duration: 200 }),
      bottom: 0,
      top: 0,
      left: 0,
      right: 0,
      borderRadius: 100,
    };
  });
  return (
    <Pressable
      className={cn('flex-1 items-center', className)}
      {...pressableProps}
      style={tabBarItemStyle}
    >
      <View className="h-8 w-16 items-center justify-center overflow-hidden rounded-full ">
        <Animated.View style={animatedStyle} className="bg-secondary/70 dark:bg-secondary" />
        <View>
          <Icon
            ios={{ useMaterialIcon: true }}
            size={24}
            name={name}
            color={isFocused ? colors.foreground : colors.grey2}
          />
          {!!badge && <Badge>{badge}</Badge>}
        </View>
      </View>
      <Text variant="caption2" className={cn('pt-1', !isFocused && 'text-muted-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}
