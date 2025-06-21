import { Portal } from '@rn-primitives/portal';
import { Icon } from '@roninoss/icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as React from 'react';
import { Dimensions, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveSearchHeader } from 'nativewindui/AdaptiveSearchHeader';
import { Avatar, AvatarFallback } from 'nativewindui/Avatar';
import { Button } from 'nativewindui/Button';
import { ContextMenu } from 'nativewindui/ContextMenu';
import { createContextItem } from 'nativewindui/ContextMenu/utils';
import { DropdownMenu } from 'nativewindui/DropdownMenu';
import { createDropdownItem } from 'nativewindui/DropdownMenu/utils';
import { List, ListItem, type ListRenderItemInfo } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { Toolbar, ToolbarCTA } from 'nativewindui/Toolbar';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/useColorScheme';

export default function ConversationsAndroidScreen() {
  const { colors, isDarkColorScheme } = useColorScheme();
  const [selectedMessages, setSelectedMessages] = React.useState<string[]>([]);

  const renderItem = React.useCallback(
    (info: ListRenderItemInfo<(typeof ITEMS)[number]>) => {
      return (
        <MessageRow
          info={info}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
        />
      );
    },
    [selectedMessages]
  );

  function clearSelectedMessages() {
    setSelectedMessages([]);
  }

  return (
    <>
      <AdaptiveSearchHeader
        iosTitle="Messages"
        leftView={leftView}
        rightView={rightView}
        backgroundColor={Platform.select({
          ios: isDarkColorScheme ? colors.background : colors.card,
          default: colors.background,
        })}
        searchBar={SEARCH_BAR}
      />
      <List
        data={ITEMS}
        extraData={[selectedMessages, isDarkColorScheme]}
        contentInsetAdjustmentBehavior="automatic"
        estimatedItemSize={72}
        ItemSeparatorComponent={renderItemSeparator}
        contentContainerClassName="ios:pt-4 pt-2"
        ListFooterComponent={<View className="h-16" />} // Prevent last message from being blocked by the FAB/Toolbar
        renderItem={renderItem}
      />
      {Platform.OS === 'ios' ? (
        <Animated.View
          entering={FadeIn.duration(500)}
          className="bg-card/70 dark:bg-background/70 absolute bottom-0 left-0 right-0"
        >
          <Toolbar
            leftView={<View className="flex-1" />}
            rightView={<ToolbarCTA className="h-8 w-8" icon={{ name: 'pencil-box-outline' }} />}
            iosBlurIntensity={30}
          />
        </Animated.View>
      ) : (
        <StartChatButton />
      )}
      {selectedMessages.length > 0 && (
        <SelectMessagesHeader
          numberOfSelectedMessages={selectedMessages.length}
          clearSelectedMessages={clearSelectedMessages}
        />
      )}
    </>
  );
}

function leftView() {
  return <LeftView />;
}

function LeftView() {
  const { colors, isDarkColorScheme, toggleColorScheme } = useColorScheme();

  const dropdownItems = React.useMemo(() => {
    return [
      createDropdownItem({
        actionKey: 'go-home',
        title: 'Go Home',
        icon: { name: 'home' },
      }),
      createDropdownItem({
        actionKey: 'toggle-theme',
        title: 'Toggle Theme',
        icon: { name: isDarkColorScheme ? 'moon.stars' : 'sun.min', namingScheme: 'sfSymbol' },
      }),
    ];
  }, [isDarkColorScheme]);

  function onItemPress({ actionKey }: { actionKey: string }) {
    if (actionKey === 'go-home') {
      router.push('../');
      return;
    }
    if (actionKey === 'toggle-theme') {
      toggleColorScheme();
      return;
    }
    console.log('NOT IMPLEMENTED');
  }
  return (
    <DropdownMenu items={dropdownItems} onItemPress={onItemPress}>
      <Button
        variant="plain"
        size={Platform.select({ ios: 'md', default: 'icon' })}
        className="ios:px-0"
      >
        <Icon
          ios={{ name: 'line.3.horizontal' }}
          materialIcon={{ name: 'menu', type: 'MaterialCommunityIcons' }}
          color={colors.foreground}
        />
      </Button>
    </DropdownMenu>
  );
}

function rightView() {
  return <RightView />;
}

function RightView() {
  const { colors } = useColorScheme();
  return (
    <Button size="icon" variant="plain" className="ios:justify-end">
      <Icon name="account-circle-outline" color={colors.foreground} />
    </Button>
  );
}

const SEARCH_BAR = {
  content: <SearchBarContent />,
};

function SearchBarContent() {
  const { colors } = useColorScheme();
  return (
    <View className={cn('flex-1', Platform.OS === 'ios' && 'bg-card dark:bg-background')}>
      <View className="pt-12">
        <Text className="pb-3 pl-4 font-medium" variant="callout">
          Categories
        </Text>
        <ScrollView
          horizontal
          contentContainerClassName="gap-4 px-4"
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          <Pressable className="border-foreground/20 aspect-square w-28 items-center justify-center rounded-lg border">
            <Icon color={colors.foreground} size={24} name="star-outline" />
            <Text variant="footnote">Starred</Text>
          </Pressable>
          <Pressable className="border-foreground/20 aspect-square w-28 items-center justify-center rounded-lg border">
            <Icon color={colors.foreground} size={24} name="image-outline" />
            <Text variant="footnote">Image</Text>
          </Pressable>
          <Pressable className="border-foreground/20 aspect-square w-28 items-center justify-center rounded-lg border">
            <Icon color={colors.foreground} size={24} name="video-outline" />
            <Text variant="footnote">Video</Text>
          </Pressable>
          <Pressable className="border-foreground/20 aspect-square w-28 items-center justify-center rounded-lg border">
            <Icon color={colors.foreground} size={24} name="map-outline" />
            <Text variant="footnote">Places</Text>
          </Pressable>
          <Pressable className="border-foreground/20 aspect-square w-28 items-center justify-center rounded-lg border">
            <Icon color={colors.foreground} size={24} name="link" />
            <Text variant="footnote">Links</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function MessageRow({
  info,
  selectedMessages,
  setSelectedMessages,
}: {
  info: ListRenderItemInfo<(typeof ITEMS)[number]>;
  selectedMessages: string[];
  setSelectedMessages: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  function onListItemPress() {
    if (selectedMessages.length > 0) {
      setSelectedMessages((prev) => {
        if (prev.includes(info.item.id)) {
          return prev.filter((id) => id !== info.item.id);
        }
        return [...prev, info.item.id];
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    router.push('/messages-android/chat-android');
  }

  function onListItemLongPress() {
    setSelectedMessages((prev) => {
      if (prev.includes(info.item.id)) {
        return prev.filter((id) => id !== info.item.id);
      }
      return [...prev, info.item.id];
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <Swipeable>
      <View className="pl-2">
        <IosContextMenu>
          <ListItem
            {...info}
            removeSeparator
            subTitleNumberOfLines={info.item.unread ? 3 : 1}
            onPress={onListItemPress}
            onLongPress={onListItemLongPress}
            className={cn(
              'ios:bg-card bg-background rounded-l-xl',
              selectedMessages.includes(info.item.id) &&
                'bg-primary/15 dark:bg-primary/30 ios:bg-primary/15'
            )}
            androidRootClassName="rounded-l-xl"
            leftView={
              <View className="flex-1 flex-row py-4 pl-3 pr-5">
                <Avatar alt="avatar">
                  {selectedMessages.includes(info.item.id) ? (
                    <AvatarFallback className="bg-primary">
                      <Icon
                        size={Platform.select({ ios: 24, default: 27 })}
                        name="check"
                        color="white"
                      />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-primary/60">
                      <View className="opacity-90 dark:opacity-80">
                        <Icon size={32} name="person" color="white" />
                      </View>
                    </AvatarFallback>
                  )}
                </Avatar>
              </View>
            }
            titleClassName={cn('pb-1', info.item.unread && 'font-medium')}
            subTitleClassName={cn(info.item.unread && 'font-medium')}
            rightView={
              <View className="items-end pr-4">
                <Text
                  variant="footnote"
                  className={cn('text-muted-foreground', info.item.unread && 'font-medium')}
                >
                  3:08PM
                </Text>
                <View className="w-[22px] justify-center pl-1 pt-2 ">
                  {info.item.unread && <View className="bg-primary h-3 w-3 rounded-full" />}
                </View>
              </View>
            }
          />
        </IosContextMenu>
      </View>
    </Swipeable>
  );
}

function IosContextMenu({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'ios') {
    return <>{children}</>;
  }
  return (
    <ContextMenu
      style={{ borderRadius: 16 }}
      items={[
        createContextItem({ actionKey: 'archive', title: 'Archive' }),
        createContextItem({ actionKey: 'delete', title: 'Delete', destructive: true }),
      ]}
    >
      {children}
    </ContextMenu>
  );
}

function renderItemSeparator() {
  return <View className="h-1" />;
}

function StartChatButton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ bottom: insets.bottom + 12 }} className="absolute bottom-24 right-4 z-50">
      <View className="bg-background rounded-xl shadow-xl">
        <Button size="lg">
          <Icon color="white" size={24} name="message-outline" />
          <Text className="py-1 text-[15px]">Start chat</Text>
        </Button>
      </View>
    </View>
  );
}

const DROPDOWN_ITEMS = [
  createDropdownItem({ actionKey: 'mark-as-read', title: 'Mark as read' }),
  createDropdownItem({ actionKey: 'block', title: 'Block' }),
];

const MATERIAL_HEADER_HEIGHT = 74;

function SelectMessagesHeader({
  numberOfSelectedMessages,
  clearSelectedMessages,
}: {
  numberOfSelectedMessages: number;
  clearSelectedMessages: () => void;
}) {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  return (
    <Portal name="header-replacer">
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        style={{
          height: Platform.select({
            default: MATERIAL_HEADER_HEIGHT + insets.top,
          }),
        }}
        className="bg-card absolute left-0 right-0 top-0 justify-end px-3 pb-4 shadow-md"
      >
        <View className="flex-row items-center justify-between gap-4">
          <Button size="icon" variant="plain" onPress={clearSelectedMessages}>
            <Icon name="close" size={24} color={colors.primary} />
          </Button>
          <View className="flex-1">
            <Text variant="title3" className="text-primary">
              {numberOfSelectedMessages} selected
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button size="icon" variant="plain">
              <Icon name="inbox-arrow-down" size={21} color={colors.primary} />
            </Button>
            <Button size="icon" variant="plain">
              <Icon name="trash-can-outline" size={21} color={colors.primary} />
            </Button>
            <DropdownMenu items={DROPDOWN_ITEMS}>
              <Button size="icon" variant="plain" className="rotate-90">
                <Icon name="dots-horizontal" size={21} color={colors.foreground} />
              </Button>
            </DropdownMenu>
          </View>
        </View>
      </Animated.View>
    </Portal>
  );
}

const dimensions = Dimensions.get('window');

const BUTTON_WIDTH = 75;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const ACTION_BUTTON_STYLE: ViewStyle = {
  width: BUTTON_WIDTH,
};

function Swipeable({ children }: { children: React.ReactNode }) {
  const translateX = useSharedValue(0);
  const previousTranslateX = useSharedValue(0);
  const initialTouchLocation = useSharedValue<{ x: number; y: number } | null>(null);

  const rootStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });
  const leftActionStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      flex: 1,
      height: '100%',
      width: interpolate(translateX.value, [0, dimensions.width], [0, dimensions.width]),
      overflow: 'hidden',
    };
  });
  const rightActionStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      right: 0,
      flex: 1,
      height: '100%',
      width: interpolate(-translateX.value, [0, dimensions.width], [0, dimensions.width]),
      overflow: 'hidden',
    };
  });
  const leftIconStyle = useAnimatedStyle(() => {
    return {
      height: '100%',
      width: BUTTON_WIDTH,
      position: 'absolute',
      left: 0,
      opacity: translateX.value > 1 ? 1 : 0,
    };
  });
  const rightIconStyle = useAnimatedStyle(() => {
    return {
      height: '100%',
      width: BUTTON_WIDTH,
      position: 'absolute',
      right: 0,
      opacity: translateX.value < 0 ? 1 : 0,
    };
  });

  function onArchive() {
    console.log('onArchive');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const pan = Gesture.Pan()
    .manualActivation(Platform.OS !== 'ios')
    .onBegin((evt) => {
      initialTouchLocation.value = { x: evt.x, y: evt.y };
    })
    .onStart(() => {
      previousTranslateX.value = translateX.value;
    })
    // Prevents blocking the scroll view
    .onTouchesMove((evt, state) => {
      if (!initialTouchLocation.value || !evt.changedTouches.length) {
        state.fail();
        return;
      }

      const xDiff = Math.abs(evt.changedTouches[0].x - initialTouchLocation.value.x);
      const yDiff = Math.abs(evt.changedTouches[0].y - initialTouchLocation.value.y);
      const isHorizontalPanning = xDiff > yDiff;
      if (isHorizontalPanning && xDiff > 0.5) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate((event) => {
      translateX.value = clamp(
        event.translationX + previousTranslateX.value,
        -dimensions.width,
        dimensions.width
      );
    })
    .onEnd((event) => {
      const right = event.translationX > 0 && translateX.value > 0;
      const left = event.translationX < 0 && translateX.value < 0;

      if (right) {
        if (translateX.value > dimensions.width / 2) {
          translateX.value = withSpring(dimensions.width, SPRING_CONFIG);
          runOnJS(onArchive)();
          return;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        return;
      }

      if (left) {
        if (translateX.value < -dimensions.width / 2) {
          translateX.value = withSpring(-dimensions.width, SPRING_CONFIG);
          runOnJS(onArchive)();
          return;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        return;
      }

      translateX.value = withSpring(0, SPRING_CONFIG);
    });

  return (
    <GestureDetector gesture={pan}>
      <View>
        <Animated.View style={leftActionStyle} className="bg-primary/80">
          <Animated.View style={leftIconStyle}>
            <View
              style={ACTION_BUTTON_STYLE}
              className="absolute bottom-0 right-0 top-0 items-center justify-center"
            >
              <Icon name="archive-arrow-up-outline" size={24} color="white" />
            </View>
          </Animated.View>
        </Animated.View>
        <Animated.View style={rightActionStyle} className="bg-primary/80">
          <Animated.View style={rightIconStyle}>
            <View
              style={ACTION_BUTTON_STYLE}
              className="absolute bottom-0 right-0 top-0 items-center justify-center"
            >
              <Icon name="archive-arrow-up-outline" size={24} color="white" />
            </View>
          </Animated.View>
        </Animated.View>
        <Animated.View style={rootStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const ITEMS = [
  {
    id: '1',
    contact: true,
    unread: true,
    title: 'Alice Johnson',
    subTitle:
      'Hi team, please find the latest updates on the project. We have completed the initial phase and are moving into the testing stage.',
    timestamp: '8:32 AM',
  },
  {
    id: '2',
    contact: true,
    unread: true,
    title: 'Bob Smith',
    subTitle:
      'Reminder: We have a team meeting scheduled for tomorrow at 10 AM. Please make sure to bring your reports.',
    timestamp: 'Yesterday',
  },
  {
    id: '3',
    contact: false,
    unread: false,
    title: '(555) 123-4567',
    subTitle:
      'You have a missed call from this number. Please call back at your earliest convenience.',
    timestamp: 'Saturday',
  },
  {
    id: '4',
    contact: true,
    unread: false,
    title: 'Catherine Davis',
    subTitle:
      'Hi, please find attached the invoice for the services provided last month. Let me know if you need any further information.',
    timestamp: 'Last Tuesday',
  },
  {
    id: '5',
    contact: true,
    unread: true,
    title: 'Daniel Brown',
    subTitle: "Hey, are you free for lunch this Thursday? Let's catch up!",
    timestamp: '10:15 AM',
  },
  {
    id: '6',
    contact: false,
    unread: false,
    title: '(555) 987-6543',
    subTitle:
      'Your service appointment is scheduled for June 29th. Please be available during the time slot.',
    timestamp: '2024-06-29',
  },
  {
    id: '7',
    contact: true,
    unread: false,
    title: 'Evelyn Clark',
    subTitle: 'Wishing you a very happy birthday! Have a great year ahead.',
    timestamp: '2024-06-29',
  },
  {
    id: '8',
    contact: false,
    unread: false,
    title: '(555) 321-7654',
    subTitle: "Don't forget to submit your timesheet by the end of the day.",
    timestamp: '2024-06-29',
  },
  {
    id: '9',
    contact: true,
    unread: false,
    title: 'Fiona Wilson',
    subTitle: 'Attached is the weekly report for your review. Please provide your feedback.',
    timestamp: '2024-06-29',
  },
  {
    id: '10',
    contact: true,
    unread: false,
    title: 'George Martinez',
    subTitle:
      'Hi all, we are planning a team outing next weekend. Please confirm your availability.',
    timestamp: '2024-06-29',
  },
  {
    id: '11',
    contact: false,
    unread: false,
    title: '(555) 654-3210',
    subTitle:
      'Congratulations! You are eligible for a special promotion. Contact us to learn more.',
    timestamp: '2024-06-29',
  },
  {
    id: '12',
    contact: true,
    unread: false,
    title: 'Hannah Lee',
    subTitle:
      'Hi, your contract is up for renewal. Please review the attached document and let us know if you have any questions.',
    timestamp: '2024-06-29',
  },
];
