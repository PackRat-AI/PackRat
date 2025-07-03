import { Icon } from "@roninoss/icons";
import {
  Avatar,
  AvatarFallback,
} from "expo-app/components/nativewindui/Avatar";
import { Button } from "expo-app/components/nativewindui/Button";
import { Checkbox } from "expo-app/components/nativewindui/Checkbox";
import { ContextMenu } from "expo-app/components/nativewindui/ContextMenu";
import { createContextItem } from "expo-app/components/nativewindui/ContextMenu/utils";
import { DropdownMenu } from "expo-app/components/nativewindui/DropdownMenu";
import { createDropdownItem } from "expo-app/components/nativewindui/DropdownMenu/utils";
import { LargeTitleHeader } from "expo-app/components/nativewindui/LargeTitleHeader";
import {
  List,
  ListItem,
  type ListRenderItemInfo,
} from "expo-app/components/nativewindui/List";
import { Text } from "expo-app/components/nativewindui/Text";
import { Toolbar } from "expo-app/components/nativewindui/Toolbar";
import { cn } from "expo-app/lib/cn";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as React from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export default function ConversationsIosScreen() {
  const { colors, isDarkColorScheme } = useColorScheme();
  const [isSelecting, setIsSelecting] = React.useState(false);
  const isSelectingDerived = useDerivedValue(() => isSelecting);
  const [selectedMessages, setSelectedMessages] = React.useState<string[]>([]);

  const checkboxContainerStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(isSelectingDerived.value ? 32 : 0, { duration: 150 }),
    };
  });

  const renderItem = React.useCallback(
    (info: ListRenderItemInfo<(typeof ITEMS)[number]>) => {
      return (
        <MessageRow
          info={info}
          checkboxContainerStyle={checkboxContainerStyle}
          isSelecting={isSelecting}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
        />
      );
    },
    [isSelecting, selectedMessages]
  );

  function onIsSelectingChange(value: boolean) {
    if (!value) {
      setSelectedMessages([]);
    }
    setIsSelecting(value);
  }

  return (
    <>
      <LargeTitleHeader
        title="Messages"
        leftView={() => (
          <LeftView
            isSelecting={isSelecting}
            setIsSelecting={onIsSelectingChange}
          />
        )}
        rightView={rightView}
        backgroundColor={isDarkColorScheme ? colors.background : colors.card}
        searchBar={SEARCH_BAR}
      />
      <List
        data={ITEMS}
        extraData={[isSelecting, selectedMessages]}
        contentInsetAdjustmentBehavior="automatic"
        ListFooterComponent={
          isSelecting ? <View className="h-[46px]" /> : undefined
        }
        estimatedItemSize={88}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
      {isSelecting && (
        <SelectingToolbar hasSelectedAMessage={selectedMessages.length > 0} />
      )}
    </>
  );
}

function LeftView({
  isSelecting,
  setIsSelecting,
}: {
  isSelecting: boolean;
  setIsSelecting: (value: boolean) => void;
}) {
  const { isDarkColorScheme, toggleColorScheme } = useColorScheme();

  const dropdownItems = React.useMemo(() => {
    return [
      createDropdownItem({
        actionKey: "go-home",
        title: "Go Home",
        icon: { name: "home" },
      }),
      createDropdownItem({
        actionKey: "select-messages",
        title: "Select messages",
        icon: { name: "checkmark.circle", namingScheme: "sfSymbol" },
      }),
      createDropdownItem({
        actionKey: "toggle-theme",
        title: "Toggle Theme",
        icon: {
          name: isDarkColorScheme ? "moon.stars" : "sun.min",
          namingScheme: "sfSymbol",
        },
      }),
    ];
  }, [isDarkColorScheme]);

  function onItemPress({ actionKey }: { actionKey: string }) {
    if (actionKey === "go-home") {
      router.push("../");
      return;
    }
    if (actionKey === "toggle-theme") {
      toggleColorScheme();
      return;
    }
    if (actionKey === "select-messages") {
      setIsSelecting(true);
      return;
    }
    console.log("NOT IMPLEMENTED");
  }

  if (isSelecting) {
    return (
      <Button
        variant="plain"
        size="md"
        className="ios:px-0 px-2 py-1"
        onPress={() => setIsSelecting(false)}
      >
        <Text className="font-normal text-primary">Done</Text>
      </Button>
    );
  }
  return (
    <DropdownMenu items={dropdownItems} onItemPress={onItemPress}>
      <Button variant="plain" size="md" className="ios:px-0 px-2 py-1">
        <Text className="font-normal text-primary">Edit</Text>
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
      <Icon
        size={24}
        name="pencil-box-outline"
        color={Platform.select({
          ios: colors.primary,
          default: colors.foreground,
        })}
      />
    </Button>
  );
}

const SEARCH_BAR = {
  iosHideWhenScrolling: true,
  content: (
    <View
      className={cn(
        "flex-1",
        Platform.OS === "ios" && "bg-card dark:bg-background"
      )}
    >
      <Animated.View
        entering={FadeIn.delay(150)}
        className="ios:pt-4 flex-row border-b border-border px-4 pb-4"
      >
        <View className="items-center gap-2 py-2">
          <Avatar alt="avatar" className="h-12 w-12">
            <AvatarFallback>
              <View className="opacity-90 dark:opacity-80">
                <Text
                  className="dark:ios:text-white leading-6 text-white dark:text-background"
                  variant="title3"
                >
                  GM
                </Text>
              </View>
            </AvatarFallback>
          </Avatar>
          <Text variant="caption1">George Martinez</Text>
        </View>
      </Animated.View>
    </View>
  ),
};

const CONTEXT_MENU_ITEMS = [
  createContextItem({
    actionKey: "hide-alerts",
    title: "Hide Alerts",
    icon: { name: "bell-outline" },
  }),
  createContextItem({
    actionKey: "delete",
    title: "Delete",
    icon: { name: "trash-can-outline", color: "red" },
    destructive: true,
  }),
];

const TIME_STAMP_WIDTH = 96;

const TEXT_STYLE: TextStyle = {
  paddingRight: TIME_STAMP_WIDTH,
};

const TIMESTAMP_CONTAINER_STYLE = {
  maxWidth: TIME_STAMP_WIDTH,
};

function MessageRow({
  info,
  selectedMessages,
  setSelectedMessages,
  isSelecting,
  checkboxContainerStyle,
}: {
  info: ListRenderItemInfo<(typeof ITEMS)[number]>;
  selectedMessages: string[];
  setSelectedMessages: React.Dispatch<React.SetStateAction<string[]>>;
  isSelecting: boolean;
  checkboxContainerStyle: ViewStyle;
}) {
  const { colors } = useColorScheme();

  function onListItemPress() {
    if (isSelecting) {
      if (selectedMessages.includes(info.item.id)) {
        setSelectedMessages(
          selectedMessages.filter((id) => id !== info.item.id)
        );
        return;
      }
      setSelectedMessages([...selectedMessages, info.item.id]);
      return;
    }
    router.push("/messages-ios/chat-ios");
  }

  function onCheckedChange(isChecked: boolean) {
    if (isChecked) {
      setSelectedMessages((prev) => [...prev, info.item.id]);
    } else {
      setSelectedMessages((prev) => prev.filter((id) => id !== info.item.id));
    }
  }

  return (
    <Swipeable isUnread={info.item.unread}>
      <ContextMenu
        items={CONTEXT_MENU_ITEMS}
        iosRenderPreview={renderIosContextMenuPreview(info)}
        materialAlign="center"
      >
        <ListItem
          {...info}
          subTitleNumberOfLines={2}
          onLongPress={noop} // Prevent onPress from firing when long pressing with quick release
          onPress={onListItemPress}
          className={cn(
            "h-[88px]",
            selectedMessages.includes(info.item.id) && "bg-muted/15",
            selectedMessages.includes(info.item.id) &&
              Platform.OS === "ios" &&
              "dark:bg-muted/50 bg-muted/20",
            info.index === 0 &&
              "ios:border-t-0 border-border/25 dark:border-border/80 border-t"
          )}
          leftView={
            <View className="flex-1 flex-row items-center px-3 py-3 pl-2">
              <Animated.View
                style={checkboxContainerStyle}
                className="items-center justify-center"
              >
                {isSelecting && (
                  <Checkbox
                    checked={selectedMessages.includes(info.item.id)}
                    onCheckedChange={onCheckedChange}
                  />
                )}
              </Animated.View>
              <View className="w-6 items-center justify-center">
                <View className="pr-0.5">
                  {info.item.unread && (
                    <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </View>
              </View>
              <Avatar alt="avatar" className="h-12 w-12">
                <AvatarFallback>
                  <View className="opacity-90 dark:opacity-80">
                    {info.item.contact ? (
                      <Text
                        className="dark:ios:text-white leading-6 text-white dark:text-background"
                        variant="title3"
                      >
                        {getInitials(info.item.title)}
                      </Text>
                    ) : (
                      <Icon
                        size={36}
                        name="person"
                        color={Platform.select({
                          ios: "white",
                          default: colors.background,
                        })}
                      />
                    )}
                  </View>
                </AvatarFallback>
              </Avatar>
            </View>
          }
          titleStyle={TEXT_STYLE}
          titleClassName="font-medium text-lg"
          subTitleClassName="pt-0.5"
          rightView={
            <>
              <View className="pr-3">
                {!isSelecting && (
                  <Icon name="chevron-right" size={15} color={colors.grey} />
                )}
              </View>
            </>
          }
        />
      </ContextMenu>
      <View
        style={TIMESTAMP_CONTAINER_STYLE}
        className="absolute right-8 top-1.5"
      >
        <Text
          numberOfLines={1}
          variant="footnote"
          className="text-muted-foreground"
        >
          {info.item.timestamp}
        </Text>
      </View>
    </Swipeable>
  );
}

const renderIosContextMenuPreview = (info: {
  item: (typeof ITEMS)[number];
}) => {
  return () => {
    return (
      <View className="bg-card/60 dark:bg-muted/70 h-96 w-screen rounded-lg p-4">
        <View className="pb-4">
          <Text variant="caption2" className="text-center">
            iMessage
          </Text>
          <Text variant="caption2" className="text-center">
            {info.item.timestamp}
          </Text>
        </View>
        <View className="pr-10">
          <View
            style={{ borderCurve: "circular" }}
            className="rounded-2xl bg-card p-3"
          >
            <Text>{info.item.subTitle}</Text>
          </View>
        </View>
      </View>
    );
  };
};

function getInitials(name: string): string {
  const nameParts = name.trim().split(/\s+/);
  const firstInitial = nameParts[0].charAt(0).toUpperCase();
  if (nameParts.length === 1) {
    return firstInitial;
  }
  const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
  return firstInitial + lastInitial;
}

const dimensions = Dimensions.get("window");

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

function Swipeable({
  children,
  isUnread,
}: {
  children: React.ReactNode;
  isUnread: boolean;
}) {
  const translateX = useSharedValue(0);
  const previousTranslateX = useSharedValue(0);
  const initialTouchLocation = useSharedValue<{ x: number; y: number } | null>(
    null
  );

  const rootStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });
  const statusActionStyle = useAnimatedStyle(() => {
    return {
      position: "absolute",
      flex: 1,
      height: "100%",
      width: interpolate(
        translateX.value,
        [0, dimensions.width],
        [0, dimensions.width]
      ),
    };
  });
  const trashActionStyle = useAnimatedStyle(() => {
    return {
      position: "absolute",
      right: 0,
      flex: 1,
      height: "100%",
      width: interpolate(
        -translateX.value,
        [0, dimensions.width],
        [0, dimensions.width]
      ),
    };
  });
  const notificationActionStyle = useAnimatedStyle(() => {
    return {
      overflow: "hidden",
      position: "absolute",
      left: interpolate(
        -translateX.value,
        [0, dimensions.width],
        [dimensions.width, 0]
      ),
      flex: 1,
      height: "100%",
      width:
        previousTranslateX.value > translateX.value
          ? interpolate(
              -translateX.value,
              [0, BUTTON_WIDTH * 2, BUTTON_WIDTH * 3, dimensions.width],
              [0, BUTTON_WIDTH, BUTTON_WIDTH * 1.2, 0]
            )
          : interpolate(
              -translateX.value,
              [0, BUTTON_WIDTH * 2, dimensions.width],
              [0, BUTTON_WIDTH, 0]
            ),
    };
  });
  const statusIconStyle = useAnimatedStyle(() => {
    return {
      overflow: "hidden",
      position: "absolute",
      left: interpolate(
        translateX.value,
        [0, BUTTON_WIDTH, BUTTON_WIDTH * 2, BUTTON_WIDTH * 3, dimensions.width],
        [-BUTTON_WIDTH, 0, 0, BUTTON_WIDTH * 2, dimensions.width - BUTTON_WIDTH]
      ),

      flex: 1,
      height: "100%",
      width: BUTTON_WIDTH,
    };
  });
  const trashIconStyle = useAnimatedStyle(() => {
    return {
      overflow: "hidden",
      position: "absolute",
      right:
        previousTranslateX.value > translateX.value
          ? interpolate(
              -translateX.value,
              [
                0,
                BUTTON_WIDTH * 2,
                BUTTON_WIDTH * 3,
                BUTTON_WIDTH * 3 + 40,
                dimensions.width,
              ],
              [
                -BUTTON_WIDTH,
                0,
                0,
                BUTTON_WIDTH + 40,
                dimensions.width - BUTTON_WIDTH,
              ]
            )
          : interpolate(
              -translateX.value,
              [0, BUTTON_WIDTH * 2, dimensions.width],
              [-BUTTON_WIDTH, 0, dimensions.width - BUTTON_WIDTH]
            ),
      flex: 1,
      height: "100%",
      width: BUTTON_WIDTH,
    };
  });

  function onToggleMarkAsRead() {
    console.log("onToggleMarkAsRead");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  function onDelete() {
    console.log("onDelete");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  function onToggleNotifications() {
    console.log("onToggleNotifications");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  const pan = Gesture.Pan()
    .manualActivation(Platform.OS !== "ios")
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

      const xDiff = Math.abs(
        evt.changedTouches[0].x - initialTouchLocation.value.x
      );
      const yDiff = Math.abs(
        evt.changedTouches[0].y - initialTouchLocation.value.y
      );
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
        if (translateX.value > BUTTON_WIDTH * 2) {
          translateX.value = withSpring(0, SPRING_CONFIG);
          runOnJS(onToggleMarkAsRead)();
          return;
        }
        translateX.value = withSpring(
          event.translationX > 0 ? BUTTON_WIDTH : -BUTTON_WIDTH,
          SPRING_CONFIG
        );
        return;
      }

      if (left) {
        if (translateX.value < -BUTTON_WIDTH * 3) {
          translateX.value = withSpring(-dimensions.width, SPRING_CONFIG);
          runOnJS(onDelete)();
          return;
        }
        translateX.value = withSpring(
          event.translationX > 0 ? BUTTON_WIDTH * 2 : -BUTTON_WIDTH * 2,
          SPRING_CONFIG
        );
        return;
      }

      translateX.value = withSpring(0, SPRING_CONFIG);
    });

  function onStatusActionPress() {
    translateX.value = withSpring(0, SPRING_CONFIG);
    onToggleMarkAsRead();
  }

  function onDeleteActionPress() {
    translateX.value = withSpring(-dimensions.width, SPRING_CONFIG);
    onDelete();
  }

  function onNotificationActionPress() {
    translateX.value = withSpring(0, SPRING_CONFIG);
    onToggleNotifications();
  }

  return (
    <GestureDetector gesture={pan}>
      <View>
        <Animated.View style={statusActionStyle} className="bg-primary">
          <Animated.View style={statusIconStyle}>
            <Pressable
              style={ACTION_BUTTON_STYLE}
              onPress={onStatusActionPress}
              className="absolute bottom-0 right-0 top-0 items-center justify-center"
            >
              <Icon
                ios={{
                  name: isUnread
                    ? "checkmark.message.fill"
                    : "message.badge.fill",
                }}
                materialIcon={{
                  type: "MaterialCommunityIcons",
                  name: isUnread ? "read" : "email-mark-as-unread",
                }}
                size={24}
                color="white"
              />
            </Pressable>
          </Animated.View>
        </Animated.View>
        <Animated.View style={trashActionStyle} className="bg-destructive">
          <Animated.View style={trashIconStyle}>
            <Pressable
              style={ACTION_BUTTON_STYLE}
              onPress={onDeleteActionPress}
              className="absolute bottom-0 right-0 top-0 items-center justify-center"
            >
              <Icon name="trash-can" size={24} color="white" />
            </Pressable>
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={notificationActionStyle}
          className="bg-violet-600"
        >
          <Pressable
            style={ACTION_BUTTON_STYLE}
            onPress={onNotificationActionPress}
            className="absolute bottom-0 left-0 top-0 items-center justify-center"
          >
            <Icon
              ios={{ name: "bell.slash.fill" }}
              materialIcon={{
                type: "MaterialCommunityIcons",
                name: "bell-cancel",
              }}
              size={24}
              color="white"
            />
          </Pressable>
        </Animated.View>
        <Animated.View style={rootStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

function SelectingToolbar({
  hasSelectedAMessage,
}: {
  hasSelectedAMessage: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      className="absolute bottom-0 left-0 right-0"
    >
      <Toolbar
        leftView={
          <Button size="sm" variant="plain">
            <Text className="text-primary">Read All</Text>
          </Button>
        }
        rightView={
          <Button size="sm" variant="plain" disabled={!hasSelectedAMessage}>
            <Text
              className={cn(
                !hasSelectedAMessage ? "text-muted-foreground" : "text-primary"
              )}
            >
              Delete
            </Text>
          </Button>
        }
      />
    </Animated.View>
  );
}

function noop() {}

const ITEMS = [
  {
    id: "1",
    contact: true,
    unread: true,
    title: "Alice Johnson",
    subTitle:
      "Hi team, please find the latest updates on the project. We have completed the initial phase and are moving into the testing stage.",
    timestamp: "8:32 AM",
  },
  {
    id: "2",
    contact: true,
    unread: true,
    title: "Bob Smith",
    subTitle:
      "Reminder: We have a team meeting scheduled for tomorrow at 10 AM. Please make sure to bring your reports.",
    timestamp: "Yesterday",
  },
  {
    id: "3",
    contact: false,
    unread: false,
    title: "(555) 123-4567",
    subTitle:
      "You have a missed call from this number. Please call back at your earliest convenience.",
    timestamp: "Saturday",
  },
  {
    id: "4",
    contact: true,
    unread: false,
    title: "Catherine Davis",
    subTitle:
      "Hi, please find attached the invoice for the services provided last month. Let me know if you need any further information.",
    timestamp: "Last Tuesday",
  },
  {
    id: "5",
    contact: true,
    unread: true,
    title: "Daniel Brown",
    subTitle: "Hey, are you free for lunch this Thursday? Let's catch up!",
    timestamp: "10:15 AM",
  },
  {
    id: "6",
    contact: false,
    unread: false,
    title: "(555) 987-6543",
    subTitle:
      "Your service appointment is scheduled for June 29th. Please be available during the time slot.",
    timestamp: "2024-06-29",
  },
  {
    id: "7",
    contact: true,
    unread: false,
    title: "Evelyn Clark",
    subTitle: "Wishing you a very happy birthday! Have a great year ahead.",
    timestamp: "2024-06-29",
  },
  {
    id: "8",
    contact: false,
    unread: false,
    title: "(555) 321-7654",
    subTitle: "Don't forget to submit your timesheet by the end of the day.",
    timestamp: "2024-06-29",
  },
  {
    id: "9",
    contact: true,
    unread: false,
    title: "Fiona Wilson",
    subTitle:
      "Attached is the weekly report for your review. Please provide your feedback.",
    timestamp: "2024-06-29",
  },
  {
    id: "10",
    contact: true,
    unread: false,
    title: "George Martinez",
    subTitle:
      "Hi all, we are planning a team outing next weekend. Please confirm your availability.",
    timestamp: "2024-06-29",
  },
  {
    id: "11",
    contact: false,
    unread: false,
    title: "(555) 654-3210",
    subTitle:
      "Congratulations! You are eligible for a special promotion. Contact us to learn more.",
    timestamp: "2024-06-29",
  },
  {
    id: "12",
    contact: true,
    unread: false,
    title: "Hannah Lee",
    subTitle:
      "Hi, your contract is up for renewal. Please review the attached document and let us know if you have any questions.",
    timestamp: "2024-06-29",
  },
];
