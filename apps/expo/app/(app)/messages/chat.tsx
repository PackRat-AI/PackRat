import { Avatar, AvatarFallback } from '@packrat/ui/nativewindui/Avatar';
import { Button } from '@packrat/ui/nativewindui/Button';
import { ContextMenu } from '@packrat/ui/nativewindui/ContextMenu';
import type { ContextMenuRef } from '@packrat/ui/nativewindui/ContextMenu/types';
import { createContextItem } from '@packrat/ui/nativewindui/ContextMenu/utils';
import { Text } from '@packrat/ui/nativewindui/Text';
import { Icon } from '@roninoss/icons';
import { FlashList } from '@shopify/flash-list';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import {
  Dimensions,
  Image,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  type TextInputContentSizeChangeEventData,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, {
  clamp,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ME = 'Alice';

const HEADER_HEIGHT = Platform.select({ ios: 88, default: 64 });

const dimensions = Dimensions.get('window');

const ROOT_STYLE: ViewStyle = {
  flex: 1,
  minHeight: 2,
};

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const SCREEN_OPTIONS = { header };

// Note: For few messages to start at top, use a FlatList instead of the FlashList
// Add `contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}` to the FlatList (it is not possible with FlashList atm)

export default function ChatIos() {
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const textInputHeight = useSharedValue(17);
  const [messages, setMessages] = React.useState(MOCK_MESSAGES);
  const translateX = useSharedValue(0);
  const previousTranslateX = useSharedValue(0);
  const initialTouchLocation = useSharedValue<{ x: number; y: number } | null>(null);

  const toolbarHeightStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        progress.value,
        [0, 1],
        [52 + insets.bottom, insets.bottom + textInputHeight.value - 2],
      ),
    };
  });

  const pan = Gesture.Pan()
    .minDistance(10)
    .onBegin((evt) => {
      initialTouchLocation.value = { x: evt.x, y: evt.y };
    })
    .onStart(() => {
      previousTranslateX.value = translateX.value;
    })
    // Prevents blocking the scroll view and the swipe to go back gesture on iOS
    .onTouchesMove((evt, state) => {
      if (!initialTouchLocation.value || !evt.changedTouches.length) {
        state.fail();
        return;
      }

      const xDiff = evt.changedTouches[0].x - initialTouchLocation.value.x;
      const yDiff = Math.abs(evt.changedTouches[0].y - initialTouchLocation.value.y);
      const isHorizontalPanning = Math.abs(xDiff) > yDiff;

      if (isHorizontalPanning && xDiff < 0) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate((event) => {
      translateX.value = clamp(event.translationX / 2 + previousTranslateX.value, -75, 0);
    })
    .onEnd((event) => {
      const right = event.translationX > 0 && translateX.value > 0;
      const left = event.translationX < 0 && translateX.value < 0;

      if (right) {
        if (translateX.value > dimensions.width / 2) {
          translateX.value = withSpring(dimensions.width, SPRING_CONFIG);
          return;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        return;
      }

      if (left) {
        if (translateX.value < -dimensions.width / 2) {
          translateX.value = withSpring(-dimensions.width, SPRING_CONFIG);
          return;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        return;
      }

      translateX.value = withSpring(0, SPRING_CONFIG);
    });

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <GestureDetector gesture={pan}>
        <KeyboardAvoidingView
          style={[
            ROOT_STYLE,
            {
              backgroundColor: isDarkColorScheme ? colors.background : colors.card,
            },
          ]}
          behavior="padding"
        >
          <FlashList
            inverted
            estimatedItemSize={70}
            ListFooterComponent={<View style={{ height: HEADER_HEIGHT + insets.top }} />}
            ListHeaderComponent={<Animated.View style={toolbarHeightStyle} />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollIndicatorInsets={{
              bottom: HEADER_HEIGHT + 10,
              top: insets.bottom + 2,
            }}
            data={messages}
            renderItem={({ item, index }) => {
              if (typeof item === 'string') {
                return <DateSeparator date={item} />;
              }

              const nextMessage = messages[index - 1];
              const isSameNextSender =
                typeof nextMessage !== 'string' ? nextMessage?.sender === item.sender : false;

              return (
                <ChatBubble
                  isSameNextSender={isSameNextSender}
                  item={item}
                  translateX={translateX}
                />
              );
            }}
          />
        </KeyboardAvoidingView>
      </GestureDetector>
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <Composer textInputHeight={textInputHeight} setMessages={setMessages} />
      </KeyboardStickyView>
    </>
  );
}

function header() {
  return <Header />;
}

const HEADER_POSITION_STYLE: ViewStyle = {
  position: 'absolute',
  zIndex: 50,
  top: 0,
  left: 0,
  right: 0,
};

const MOCK_CONVERSATION_INFO = {
  name: 'George Martinez',
  initials: 'GM',
};

function Header() {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={100}
        style={[
          HEADER_POSITION_STYLE,
          {
            paddingTop: insets.top,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-4 pb-2">
          <View className="flex-row items-center">
            <Button variant="plain" size="icon" className="ios:justify-start" onPress={router.back}>
              <Icon size={30} color={colors.primary} name="chevron-left" />
              <View className="h-5 w-5 -translate-x-4 items-center justify-center rounded-full bg-primary">
                <Text variant="caption2" className="text-center leading-[14px] text-white">
                  3
                </Text>
              </View>
            </Button>
          </View>
          <Pressable className="items-center gap-2 active:opacity-70">
            <Avatar alt="avatar" className="h-12 w-12">
              <AvatarFallback className="z-50">
                <View className="opacity-90 dark:opacity-80">
                  <Text
                    className="dark:ios:text-white leading-6 text-white dark:text-background"
                    variant="title3"
                  >
                    {MOCK_CONVERSATION_INFO.initials}
                  </Text>
                </View>
              </AvatarFallback>
            </Avatar>
            <View className="flex-row items-center">
              <Text variant="caption1">{MOCK_CONVERSATION_INFO.name}</Text>
              <Icon name="chevron-right" size={12} color={colors.grey} />
            </View>
          </Pressable>
          <Button variant="plain" size="icon" className="ios:justify-start">
            <Icon size={28} color={colors.primary} name="video-outline" />
          </Button>
        </View>
      </BlurView>
    );
  }

  return (
    <View
      className="absolute left-0 right-0 top-0 z-50 justify-end bg-card dark:bg-background"
      style={{
        paddingTop: insets.top,
        height: HEADER_HEIGHT + insets.top,
      }}
    >
      <View
        style={{ height: HEADER_HEIGHT }}
        className="flex-row items-center justify-between gap-2 px-3 pb-2"
      >
        <View className="flex-row items-center">
          <Button
            variant="plain"
            size="icon"
            className="ios:justify-start opacity-70"
            onPress={router.back}
          >
            <Icon
              color={colors.foreground}
              name={Platform.select({
                ios: 'chevron-left',
                default: 'arrow-left',
              })}
            />
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="plain"
            androidRootClassName="rounded-md"
            className="ios:px-0 min-h-10 flex-row items-center justify-start gap-3 rounded-md px-0"
          >
            <View className="flex-1 flex-row items-center">
              <Text className="pb-0.5 text-lg font-normal" numberOfLines={1}>
                {MOCK_CONVERSATION_INFO.name}
              </Text>
            </View>
          </Button>
        </View>
        <Button variant="plain" size="icon" className="opacity-70">
          <Icon color={colors.foreground} name="video-outline" />
        </Button>
      </View>
    </View>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <View className="items-center px-4 pb-3 pt-5">
      <Text variant="caption2" className="font-medium text-muted-foreground">
        {date}
      </Text>
    </View>
  );
}

// Add as class when possible: https://github.com/marklawlor/nativewind/issues/522
const BORDER_CURVE: ViewStyle = {
  borderCurve: 'continuous',
};

const CONTEXT_MENU_ITEMS = [
  createContextItem({
    actionKey: 'reply',
    title: 'Reply',
    icon: { name: 'arrow-left-bold-outline' },
  }),
  createContextItem({
    actionKey: 'sticker',
    title: 'Sticker',
    icon: { name: 'plus-box-outline' },
  }),
  createContextItem({
    actionKey: 'copy',
    title: 'Copy',
    icon: { name: 'clipboard-outline' },
  }),
];

function ChatBubble({
  item,
  isSameNextSender,
  translateX,
}: {
  item: MockMessage;
  isSameNextSender: boolean;
  translateX: SharedValue<number>;
}) {
  const contextMenuRef = React.useRef<ContextMenuRef>(null);
  const contextMenuRef2 = React.useRef<ContextMenuRef>(null);
  const { colors } = useColorScheme();
  const rootStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const dateStyle = useAnimatedStyle(() => {
    return {
      width: 75,
      position: 'absolute',
      right: 0,
      paddingLeft: 8,
      transform: [{ translateX: interpolate(translateX.value, [-75, 0], [0, 75]) }],
    };
  });

  const renderAuxiliaryPreview = React.useCallback(() => {
    function closeContextMenu() {
      contextMenuRef.current?.dismissMenu?.();
      contextMenuRef2.current?.dismissMenu?.();
    }
    return (
      <View
        className={cn(
          'flex-row gap-1 rounded-full bg-card p-0.5',
          Platform.OS === 'ios' && 'ios:bg-card/60 ios:dark:bg-border/70',
        )}
      >
        <Button
          size="icon"
          variant={item.reactions.love?.includes(ME) ? 'primary' : 'plain'}
          onPress={closeContextMenu}
          className="ios:rounded-full rounded-full"
        >
          <Icon
            name="heart"
            size={24}
            color={item.reactions.love?.includes(ME) ? 'white' : colors.grey}
          />
        </Button>
        <Button
          size="icon"
          variant={item.reactions.like?.includes(ME) ? 'primary' : 'plain'}
          onPress={closeContextMenu}
          className="ios:rounded-full rounded-full"
        >
          <Icon
            ios={{ name: 'hand.thumbsup.fill' }}
            materialIcon={{
              type: 'MaterialCommunityIcons',
              name: 'thumb-up',
            }}
            size={24}
            color={item.reactions.like?.includes(ME) ? 'white' : colors.grey}
          />
        </Button>
        <Button
          size="icon"
          variant={item.reactions.dislike?.includes(ME) ? 'primary' : 'plain'}
          onPress={closeContextMenu}
          className="ios:rounded-full rounded-full"
        >
          <Icon
            ios={{ name: 'hand.thumbsdown.fill' }}
            materialIcon={{
              type: 'MaterialCommunityIcons',
              name: 'thumb-down',
            }}
            size={24}
            color={item.reactions.dislike?.includes(ME) ? 'white' : colors.grey}
          />
        </Button>
        <Button
          size="icon"
          variant={item.reactions.exclamation?.includes(ME) ? 'primary' : 'plain'}
          onPress={closeContextMenu}
          className="ios:rounded-full rounded-full"
        >
          <Icon
            name="exclamation"
            size={24}
            color={item.reactions.exclamation?.includes(ME) ? 'white' : colors.grey}
          />
        </Button>
        <Button
          size="icon"
          variant={item.reactions.question?.includes(ME) ? 'primary' : 'plain'}
          onPress={closeContextMenu}
          className="ios:rounded-full rounded-full"
        >
          <Icon
            ios={{ name: 'questionmark' }}
            materialIcon={{
              type: 'MaterialCommunityIcons',
              name: 'comment-question-outline',
            }}
            size={24}
            color={item.reactions.question?.includes(ME) ? 'white' : colors.grey}
          />
        </Button>
      </View>
    );
  }, [colors, item.reactions]);

  const auxiliaryPreviewPosition = React.useMemo(() => {
    const textIsLessThan25 = item.text.length < 25;

    return item.sender === ME
      ? textIsLessThan25
        ? 'end'
        : 'start'
      : textIsLessThan25
        ? 'start'
        : 'end';
  }, [item.text, item.sender]);

  return (
    <View
      className={cn(
        'justify-center px-2 pb-3.5',
        isSameNextSender ? 'pb-1' : 'pb-3.5',
        item.sender === ME ? 'items-end pl-16' : 'items-start pr-16',
      )}
    >
      <Animated.View style={item.sender === ME ? rootStyle : undefined}>
        {item.attachments.length > 0 ? (
          <View
            className={cn('flex-row items-center gap-4', item.sender === ME && 'flex-row-reverse')}
          >
            <View>
              <ContextMenu
                ref={contextMenuRef}
                style={{ borderRadius: 12 }}
                auxiliaryPreviewPosition={auxiliaryPreviewPosition}
                renderAuxiliaryPreview={renderAuxiliaryPreview}
                items={CONTEXT_MENU_ITEMS}
                onItemPress={({ actionKey }) => console.log(`${actionKey} pressed`)}
              >
                <Pressable>
                  <Image
                    source={{ uri: item.attachments[0].url }}
                    style={{ width: 200, height: 200, resizeMode: 'cover' }}
                    borderRadius={12}
                  />
                </Pressable>
              </ContextMenu>
              {item.reactions.like?.includes(ME) && (
                <View
                  className={cn(
                    'absolute -top-3 rounded-full bg-card p-px dark:bg-background',
                    item.sender === ME ? '-left-5' : '-right-5',
                  )}
                >
                  <View className="rounded-full bg-primary p-1">
                    <Icon
                      ios={{ name: 'hand.thumbsup.fill' }}
                      materialIcon={{
                        type: 'MaterialCommunityIcons',
                        name: 'thumb-up',
                      }}
                      size={18}
                      color="white"
                    />
                    {Platform.OS === 'ios' && (
                      <>
                        <View
                          className={cn(
                            'absolute bottom-0 h-2 w-2 rounded-full bg-primary',
                            item.sender === ME ? 'left-0' : 'right-0',
                          )}
                        />
                        <View
                          className={cn(
                            'absolute -bottom-1 h-1 w-1 rounded-full bg-primary',
                            item.sender === ME ? '-left-1' : '-right-1',
                          )}
                        />
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
            <Button
              size="icon"
              variant="secondary"
              className="ios:rounded-full ios:border-border ios:h-10 ios:w-10 h-8 w-8 rounded-full border-border"
              androidRootClassName="rounded-full"
            >
              <Icon
                name="arrow-down"
                ios={{
                  name: 'arrow.down.square',
                  renderingMode: 'hierarchical',
                }}
                color={colors.primary}
                size={Platform.select({ ios: 27, default: 21 })}
              />
            </Button>
          </View>
        ) : (
          <View>
            <View
              className={cn(
                'absolute bottom-0 items-center justify-center',
                item.sender === ME ? '-right-2.5' : '-left-2 ',
              )}
            >
              {Platform.OS === 'ios' && (
                <>
                  <View
                    className={cn(
                      'h-5 w-5 rounded-full',
                      item.sender === ME
                        ? 'bg-primary'
                        : Platform.OS === 'ios'
                          ? 'bg-background dark:bg-muted'
                          : 'bg-background dark:bg-muted-foreground',
                    )}
                  />
                  <View
                    className={cn(
                      'absolute h-5 w-5 rounded-full bg-card dark:bg-background',
                      item.sender === ME ? '-right-2' : 'right-2',
                    )}
                  />
                  <View
                    className={cn(
                      'absolute h-5 w-5  -translate-y-1 rounded-full  bg-card dark:bg-background',
                      item.sender === ME ? '-right-2' : 'right-2',
                    )}
                  />
                </>
              )}
            </View>
            <View>
              <ContextMenu
                ref={contextMenuRef2}
                auxiliaryPreviewPosition={auxiliaryPreviewPosition}
                items={CONTEXT_MENU_ITEMS}
                style={{ borderRadius: 20 }}
                renderAuxiliaryPreview={renderAuxiliaryPreview}
                onItemPress={({ actionKey }) => console.log(`${actionKey} pressed`)}
              >
                <Pressable>
                  <View
                    style={BORDER_CURVE}
                    className={cn(
                      'rounded-2xl bg-background px-3 py-1.5 dark:bg-muted-foreground',
                      Platform.OS === 'ios' && 'dark:bg-muted',
                      item.sender === ME && 'bg-primary dark:bg-primary',
                    )}
                  >
                    <Text className={cn(item.sender === ME && 'text-white')}>{item.text}</Text>
                  </View>
                </Pressable>
              </ContextMenu>
              {item.reactions.like?.includes(ME) && (
                <View
                  className={cn(
                    'absolute -top-3 rounded-full bg-card p-px dark:bg-background',
                    item.sender === ME ? '-left-5' : '-right-5',
                  )}
                >
                  <View className="rounded-full bg-primary p-1">
                    <Icon
                      ios={{ name: 'hand.thumbsup.fill' }}
                      materialIcon={{
                        type: 'MaterialCommunityIcons',
                        name: 'thumb-up',
                      }}
                      size={18}
                      color="white"
                    />
                    {Platform.OS === 'ios' && (
                      <>
                        <View
                          className={cn(
                            'absolute bottom-0 h-2 w-2 rounded-full bg-primary',
                            item.sender === ME ? 'left-0' : 'right-0',
                          )}
                        />
                        <View
                          className={cn(
                            'absolute -bottom-1 h-1 w-1 rounded-full bg-primary',
                            item.sender === ME ? '-left-1' : '-right-1',
                          )}
                        />
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
        {item.sender === ME && !!item.isRead && (
          <View className="items-end pt-0.5">
            <Text variant="caption2" className="font-medium text-muted-foreground">
              Read{' '}
              <Text variant="caption2" className="font-normal text-muted-foreground">
                Yesterday
              </Text>
            </Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={dateStyle} className="justify-center">
        <Text variant="caption1" className="text-muted-foreground">
          {item.time}
        </Text>
      </Animated.View>
    </View>
  );
}

const COMPOSER_STYLE: ViewStyle = {
  position: 'absolute',
  zIndex: 50,
  bottom: 0,
  left: 0,
  right: 0,
};

const TEXT_INPUT_STYLE: TextStyle = {
  borderCurve: 'continuous',
  maxHeight: 300,
};

function Composer({
  textInputHeight,
  setMessages,
}: {
  textInputHeight: SharedValue<number>;
  setMessages: React.Dispatch<React.SetStateAction<(typeof MOCK_MESSAGES)[number][]>>;
}) {
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = React.useState('');

  function onContentSizeChange(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    textInputHeight.value = Math.max(
      Math.min(event.nativeEvent.contentSize.height, 280),
      Platform.select({ ios: 20, default: 38 }),
    );
  }

  function sendMessage() {
    setMessages((prev) => [
      {
        attachments: [],
        id: Math.random().toString(),
        reactions: {},
        readBy: [],
        sender: ME,
        text: message,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      ...prev,
    ]);
    setMessage('');
  }

  return (
    <BlurView
      intensity={Platform.select({ ios: 50, default: 0 })}
      style={[
        COMPOSER_STYLE,
        {
          backgroundColor: Platform.select({
            ios: isDarkColorScheme ? '#00000080' : '#ffffff80',
            default: isDarkColorScheme ? colors.background : colors.card,
          }),
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View className="flex-row items-end gap-2 px-4 py-2">
        <Button size="icon" className="bg-muted/30 ios:rounded-full mb-0.5 h-8 w-8 rounded-full">
          <Icon name="plus" size={18} color={colors.foreground} />
        </Button>
        <TextInput
          placeholder="Message"
          style={TEXT_INPUT_STYLE}
          className="ios:pt-[7px] ios:pb-1 min-h-9 flex-1 rounded-[18px] border border-border bg-background py-1 pl-3 pr-8 text-base leading-5 text-foreground"
          placeholderTextColor={colors.grey2}
          multiline
          onContentSizeChange={onContentSizeChange}
          onChangeText={setMessage}
          value={message}
        />
        <View className="absolute bottom-3 right-5">
          {message.length > 0 ? (
            <Button
              onPress={sendMessage}
              size="icon"
              className="ios:rounded-full h-7 w-7 rounded-full"
            >
              <Icon name="arrow-up" size={18} color="white" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="plain"
              className="ios:rounded-full h-7 w-7 rounded-full opacity-40"
            >
              <Icon name="microphone" size={20} color={colors.foreground} />
            </Button>
          )}
        </View>
      </View>
    </BlurView>
  );
}

type MockMessage = {
  id: string;
  sender: string;
  text: string;
  date: string;
  time: string;
  reactions: {
    like?: string[];
    love?: string[];
    dislike?: string[];
    exclamation?: string[];
    question?: string[];
  };
  isRead?: boolean;
  attachments: { type: string; url: string }[];
};

const MOCK_MESSAGES: (string | MockMessage)[] = [
  {
    id: '36',
    sender: 'Bob',
    text: 'Hope you get some rest soon!',
    date: '2024-07-13',
    time: '10:08 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '35',
    sender: 'Alice',
    text: 'Just yesterday. Still a bit jet-lagged.',
    date: '2024-07-13',
    time: '10:07 AM',
    reactions: {},
    isRead: true,
    attachments: [],
  },
  {
    id: '34',
    sender: 'Bob',
    text: 'When did you get back?',
    date: '2024-07-13',
    time: '10:06 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '33',
    sender: 'Alice',
    text: 'Yes, it was a great trip.',
    date: '2024-07-13',
    time: '10:05 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '32',
    sender: 'Bob',
    text: 'That looks amazing!',
    date: '2024-07-13',
    time: '10:04 AM',
    reactions: {
      like: ['Alice'],
    },
    attachments: [],
  },
  {
    id: '31',
    sender: 'Alice',
    text: '',
    date: '2024-07-13',
    time: '10:03 AM',
    reactions: {
      like: ['Alice'],
    },
    attachments: [
      {
        type: 'image',
        url: 'https://loremflickr.com/640/360',
      },
    ],
  },
  {
    id: '30',
    sender: 'Alice',
    text: 'Here is a picture of the sunset from my vacation!',
    date: '2024-07-13',
    time: '10:02 AM',
    reactions: {
      love: [],
    },
    attachments: [
      {
        type: 'image',
        url: 'https://placebear.com/640/360',
      },
    ],
  },
  {
    id: '29',
    sender: 'Bob',
    text: 'I am good, thanks! How about you?',
    date: '2024-07-13',
    time: '10:01 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '28',
    sender: 'Alice',
    text: 'Hey, how are you?',
    date: '2024-07-13',
    time: '10:00 AM',
    reactions: {
      like: [],
    },
    attachments: [],
  },
  'Mon, 13 Jul 2024 10:00 AM',

  {
    id: '27',
    sender: 'Bob',
    text: 'Hope you get some rest soon!',
    date: '2024-07-12',
    time: '10:08 AM',
    reactions: {
      like: ['Alice'],
    },
    attachments: [],
  },
  {
    id: '26',
    sender: 'Alice',
    text: 'Just yesterday. Still a bit jet-lagged.',
    date: '2024-07-12T10:07:00Z',
    time: '10:07 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '25',
    sender: 'Bob',
    text: 'When did you get back?',
    date: '2024-07-12T10:06:00Z',
    time: '10:06 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '24',
    sender: 'Alice',
    text: 'Yes, it was a great trip.',
    date: '2024-07-12T10:05:00Z',
    time: '10:05 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '23',
    sender: 'Bob',
    text: 'That looks amazing!',
    date: '2024-07-12T10:04:00Z',
    time: '10:04 AM',
    reactions: {
      like: ['Alice'],
    },
    attachments: [],
  },
  {
    id: '22',
    sender: 'Alice',
    text: '',
    date: '2024-07-12T10:03:00Z',
    time: '10:03 AM',
    reactions: {},
    attachments: [
      {
        type: 'image',
        url: 'https://loremflickr.com/640/360',
      },
    ],
  },
  {
    id: '21',
    sender: 'Alice',
    text: 'Here is a picture of the sunset from my vacation!',
    date: '2024-07-12T10:02:00Z',
    time: '10:02 AM',
    reactions: {
      like: [],
      love: [],
      dislike: [],
      exclamation: [],
      question: [],
    },
    attachments: [
      {
        type: 'image',
        url: 'https://placebear.com/640/360',
      },
    ],
  },
  {
    id: '20',
    sender: 'Bob',
    text: 'I am good, thanks! How about you?',
    date: '2024-07-12T10:01:00Z',
    time: '10:01 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '19',
    sender: 'Alice',
    text: 'Hey, how are you?',
    date: '2024-07-12T10:00:00Z',
    time: '10:00 AM',
    reactions: {
      like: ['Bob'],
    },
    attachments: [],
  },
  'Sun, 12 Jul 2024 10:00 AM',

  {
    id: '18',
    sender: 'Bob',
    text: 'Hope you get some rest soon!',
    date: '2024-07-11T10:08:00Z',
    time: '10:08 AM',
    reactions: {
      like: ['Alice'],
    },
    attachments: [],
  },
  {
    id: '17',
    sender: 'Alice',
    text: 'Just yesterday. Still a bit jet-lagged.',
    date: '2024-07-11T10:07:00Z',
    time: '10:07 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '16',
    sender: 'Bob',
    text: 'When did you get back?',
    date: '2024-07-11T10:06:00Z',
    time: '10:06 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '15',
    sender: 'Alice',
    text: 'Yes, it was a great trip.',
    date: '2024-07-11T10:05:00Z',
    time: '10:05 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '14',
    sender: 'Bob',
    text: 'That looks amazing!',
    date: '2024-07-11T10:04:00Z',
    time: '10:04 AM',
    reactions: {
      like: ['Alice'],
    },
    attachments: [],
  },
  {
    id: '13',
    sender: 'Alice',
    text: '',
    date: '2024-07-11T10:03:00Z',
    time: '10:03 AM',
    reactions: {},
    attachments: [
      {
        type: 'image',
        url: 'https://loremflickr.com/640/360',
      },
    ],
  },
  {
    id: '12',
    sender: 'Alice',
    text: 'Here is a picture of the sunset from my vacation!',
    date: '2024-07-11T10:02:00Z',
    time: '10:02 AM',
    reactions: {
      love: [],
    },
    attachments: [
      {
        type: 'image',
        url: 'https://placebear.com/640/360',
      },
    ],
  },
  {
    id: '11',
    sender: 'Bob',
    text: 'I am good, thanks! How about you?',
    date: '2024-07-11T10:01:00Z',
    time: '10:01 AM',
    reactions: {},
    attachments: [],
  },
  {
    id: '10',
    sender: 'Alice',
    text: 'Hey, how are you?',
    date: '2024-07-11T10:00:00Z',
    time: '10:00 AM',
    reactions: {
      like: ['Bob'],
    },
    attachments: [],
  },
  'Sat, 11 Jul 2024 10:00 AM',
];
