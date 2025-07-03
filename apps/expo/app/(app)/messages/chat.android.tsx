import { Portal } from '@rn-primitives/portal';
import { Icon } from '@roninoss/icons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import {
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
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, AvatarFallback } from '~/components/nativewindui/Avatar';
import { Button } from '~/components/nativewindui/Button';
import { ContextMenu } from '~/components/nativewindui/ContextMenu';
import { DropdownMenu } from '~/components/nativewindui/DropdownMenu';
import { createDropdownItem } from '~/components/nativewindui/DropdownMenu/utils';
import { Text } from '~/components/nativewindui/Text';
import { cn } from '~/lib/cn';
import { useColorScheme } from '~/lib/hooks/useColorScheme';

const ME = 'Alice';

const HEADER_HEIGHT = 64;

const ROOT_STYLE: ViewStyle = {
  flex: 1,
  minHeight: 2,
};

const SCREEN_OPTIONS = { header };

export default function ChatAndroid() {
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const textInputHeight = useSharedValue(17);
  const [messages, setMessages] = React.useState(MOCK_MESSAGES);
  const [selectedMessages, setSelectedMessages] = React.useState<string[]>([]);

  const toolbarHeightStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        progress.value,
        [0, 1],
        [52 + insets.bottom, insets.bottom + textInputHeight.value - 2],
      ),
    };
  });

  function clearSelectedMessages() {
    setSelectedMessages([]);
  }

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />

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
          extraData={selectedMessages}
          estimatedItemSize={70}
          ListFooterComponent={<View style={{ height: HEADER_HEIGHT + insets.top }} />}
          ListHeaderComponent={<Animated.View style={toolbarHeightStyle} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ bottom: HEADER_HEIGHT + 10, top: insets.bottom + 2 }}
          data={messages}
          renderItem={({ item, index }) => {
            if (typeof item === 'string') {
              return <DateSeparator date={item} />;
            }

            const nextMessage = messages[index - 1];
            const isSameNextSender =
              typeof nextMessage !== 'string' ? nextMessage?.sender === item.sender : false;

            const previousMessage = messages[index + 1];
            const isSamePreviousSender =
              typeof previousMessage !== 'string' ? previousMessage?.sender === item.sender : false;

            return (
              <ChatBubble
                isSameNextSender={isSameNextSender}
                isSamePreviousSender={isSamePreviousSender}
                item={item}
                selectedMessages={selectedMessages}
                setSelectedMessages={setSelectedMessages}
              />
            );
          }}
        />
      </KeyboardAvoidingView>

      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <Composer textInputHeight={textInputHeight} setMessages={setMessages} />
      </KeyboardStickyView>
      {selectedMessages.length > 0 && (
        <SelectMessagesHeader
          numberOfSelectedMessages={selectedMessages.length}
          clearSelectedMessages={clearSelectedMessages}
        />
      )}
    </>
  );
}

function header() {
  return <Header />;
}

const HAS_MESSAGES_FROM_OTHER = true;

function Header() {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
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
        className="ios:gap-0 ios:px-4 flex-row items-center justify-between gap-2 px-3 pb-2"
      >
        <View className="flex-row items-center">
          <Button
            variant="plain"
            size="icon"
            className="ios:justify-start opacity-70"
            onPress={router.back}
          >
            <Icon
              size={24}
              color={colors.foreground}
              name={Platform.select({ ios: 'chevron-left', default: 'arrow-left' })}
            />
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="plain"
            androidRootClassName="rounded-md"
            className="ios:px-0 min-h-10 flex-row items-center justify-start gap-3 rounded-md px-0"
          >
            {!HAS_MESSAGES_FROM_OTHER && (
              <Avatar alt="avatar">
                <AvatarFallback className="bg-primary/60">
                  <View className="opacity-90 dark:opacity-80">
                    <Icon size={32} name="person" color="white" />
                  </View>
                </AvatarFallback>
              </Avatar>
            )}
            <View className="flex-1 flex-row items-center">
              <Text className="pb-0.5 text-lg font-normal" numberOfLines={1}>
                Alice Johnson
              </Text>
            </View>
          </Button>
        </View>
        <View className="flex-row items-center ">
          <View className="flex-row items-center gap-2 pl-1">
            <Button variant="plain" size="icon" className="ios:active:opacity-50 opacity-70">
              <Icon size={24} color={colors.foreground} name="video-outline" />
            </Button>
            <Button variant="plain" size="icon" className="ios:active:opacity-50 opacity-70">
              <Icon size={24} color={colors.foreground} name="phone-outline" />
            </Button>
          </View>
          <Button
            variant="plain"
            size="icon"
            className="ios:active:opacity-50 rotate-90 opacity-70"
          >
            <Icon size={24} name="dots-horizontal" color={colors.foreground} />
          </Button>
        </View>
      </View>
    </View>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <View className="items-center px-4 pb-3 pt-5">
      <Text variant="caption1" className="font-medium text-muted-foreground">
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
  createDropdownItem({
    actionKey: 'reply',
    title: 'Reply',
    icon: { name: 'arrow-left-bold-outline' },
  }),
  createDropdownItem({
    actionKey: 'sticker',
    title: 'Sticker',
    icon: { name: 'plus-box-outline' },
  }),
  createDropdownItem({ actionKey: 'copy', title: 'Copy', icon: { name: 'clipboard-outline' } }),
];

function ChatBubble({
  item,
  isSameNextSender,
  isSamePreviousSender,
  selectedMessages,
  setSelectedMessages,
}: {
  item: MockMessage;
  isSameNextSender: boolean;
  isSamePreviousSender: boolean;
  selectedMessages: string[];
  setSelectedMessages: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { colors } = useColorScheme();
  const [showTime, setShowTime] = React.useState(false);

  const renderAuxiliaryPreview = React.useCallback(() => {
    return (
      <View className="flex-row gap-2.5 rounded-full bg-card px-2 py-1 shadow-2xl">
        <Button
          size="icon"
          variant={item.reactions.love?.includes(ME) ? 'primary' : 'plain'}
          className={cn(
            'ios:rounded-full rounded-full',
            item.reactions.love?.includes(ME) && 'bg-primary/30',
          )}
        >
          <Text variant="title1">😍</Text>
        </Button>
        <Button
          size="icon"
          variant={item.reactions.like?.includes(ME) ? 'primary' : 'plain'}
          className={cn(
            'ios:rounded-full rounded-full',
            item.reactions.like?.includes(ME) && 'bg-primary/30',
          )}
        >
          <Text variant="title1">👍</Text>
        </Button>
        <Button
          size="icon"
          variant={item.reactions.dislike?.includes(ME) ? 'primary' : 'plain'}
          className={cn(
            'ios:rounded-full rounded-full',
            item.reactions.surprised?.includes(ME) && 'bg-primary/30',
          )}
        >
          <Text variant="title1">😮</Text>
        </Button>
        <Button
          size="icon"
          variant={item.reactions.dislike?.includes(ME) ? 'primary' : 'plain'}
          className={cn(
            'ios:rounded-full rounded-full',
            item.reactions.dislike?.includes(ME) && 'bg-primary/30',
          )}
        >
          <Text variant="title1">👎</Text>
        </Button>
        <Button
          size="icon"
          variant={item.reactions.sad?.includes(ME) ? 'primary' : 'plain'}
          className={cn(
            'ios:rounded-full rounded-full',
            item.reactions.sad?.includes(ME) && 'bg-primary/30',
          )}
        >
          <Text variant="title1">😢</Text>
        </Button>
        <Button
          size="icon"
          variant={item.reactions.angry?.includes(ME) ? 'primary' : 'plain'}
          className={cn(
            'ios:rounded-full rounded-full',
            item.reactions.angry?.includes(ME) && 'bg-primary/20',
          )}
        >
          <Text variant="title1">😡</Text>
        </Button>
      </View>
    );
  }, [colors, item.reactions]);

  function initSelectedMessages() {
    setSelectedMessages([item.id]);
  }

  function onItemPress() {
    if (selectedMessages.length === 0) {
      setShowTime((prev) => !prev);
      return;
    }
    setSelectedMessages((prev) => {
      if (prev.includes(item.id)) {
        return prev.filter((id) => id !== item.id);
      }
      return [...prev, item.id];
    });
  }

  function resetSelectedMessages() {
    if (selectedMessages.length === 0) {
      return;
    }
    setSelectedMessages([]);
  }

  const isSelected = selectedMessages.includes(item.id);

  return (
    <Pressable
      onPress={resetSelectedMessages}
      className={cn(
        'justify-center px-2 pb-3.5',
        isSameNextSender ? 'pb-1' : 'pb-3.5',
        item.sender === ME ? 'items-end pl-16' : 'items-start pr-16',
      )}
    >
      <View>
        {item.attachments.length > 0 ? (
          <View
            className={cn('flex-row items-center gap-2', item.sender === ME && 'flex-row-reverse')}
          >
            {item.sender !== ME && (
              <Avatar alt="avatar">
                <AvatarFallback className="bg-primary/60">
                  <View className="opacity-90 dark:opacity-80">
                    <Icon size={32} name="person" color="white" />
                  </View>
                </AvatarFallback>
              </Avatar>
            )}
            <View>
              <ContextMenu
                style={{ borderRadius: 12 }}
                auxiliaryPreviewPosition={item.sender === ME ? 'end' : 'start'}
                renderAuxiliaryPreview={renderAuxiliaryPreview}
                items={Platform.select({ ios: CONTEXT_MENU_ITEMS, default: [] })}
                materialOverlayClassName="bg-black/0"
                onItemPress={({ actionKey }) => console.log(`${actionKey} pressed`)}
              >
                <Pressable
                  onLongPress={initSelectedMessages}
                  onPress={onItemPress}
                  className={cn(
                    'bg-primary/20 rounded-xl',
                    isSelected && 'bg-primary',
                    isSamePreviousSender &&
                      (item.sender === ME ? 'rounded-tr-md' : 'rounded-tl-md'),
                    isSameNextSender && (item.sender === ME ? 'rounded-br-md' : 'rounded-bl-md'),
                  )}
                >
                  <Image
                    source={{ uri: item.attachments[0].url }}
                    style={{
                      width: 300,
                      height: 300,
                      resizeMode: 'cover',
                      opacity: isSelected ? 0.5 : 1,
                    }}
                    borderTopLeftRadius={item.sender !== ME ? (isSamePreviousSender ? 6 : 12) : 12}
                    borderTopRightRadius={item.sender === ME ? (isSamePreviousSender ? 6 : 12) : 12}
                    borderBottomLeftRadius={item.sender !== ME ? (isSameNextSender ? 6 : 12) : 12}
                    borderBottomRightRadius={item.sender === ME ? (isSameNextSender ? 6 : 12) : 12}
                  />
                </Pressable>
              </ContextMenu>
              {item.reactions.love?.includes(ME) && (
                <View
                  className={cn(
                    'absolute -bottom-6 rounded-full bg-card p-px dark:bg-background',
                    item.sender === ME ? 'right-0' : 'left-0',
                  )}
                >
                  <View className="bg-primary/15 dark:bg-primary/50 h-7 w-7 items-center justify-center rounded-full">
                    <Text variant="footnote">😍</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View>
            <View className={cn('flex-row items-end gap-2', item.sender === ME && 'justify-end')}>
              {item.sender !== ME && (
                <View className="">
                  <Avatar alt="avatar">
                    <AvatarFallback className="bg-primary/60">
                      <View className="opacity-90 dark:opacity-80">
                        <Icon size={32} name="person" color="white" />
                      </View>
                    </AvatarFallback>
                  </Avatar>
                </View>
              )}
              <ContextMenu
                auxiliaryPreviewPosition={item.sender === ME ? 'end' : 'start'}
                items={Platform.select({ ios: CONTEXT_MENU_ITEMS, default: [] })}
                style={{ borderRadius: 20, marginBottom: 2 }}
                renderAuxiliaryPreview={renderAuxiliaryPreview}
                materialOverlayClassName="bg-black/0"
                onItemPress={({ actionKey }) => console.log(`${actionKey} pressed`)}
              >
                <Pressable onLongPress={initSelectedMessages} onPress={onItemPress}>
                  <View
                    style={BORDER_CURVE}
                    className={cn(
                      'bg-muted/30 dark:bg-muted-foreground/50 rounded-2xl px-3 py-1.5',
                      Platform.OS === 'ios' && 'dark:bg-muted/70',
                      item.sender === ME && 'bg-primary/20 dark:bg-primary/30',
                      isSelected && 'bg-primary dark:bg-primary',
                      isSamePreviousSender &&
                        (item.sender === ME ? 'rounded-tr-md' : 'rounded-tl-md'),
                      isSameNextSender && (item.sender === ME ? 'rounded-br-md' : 'rounded-bl-md'),
                    )}
                  >
                    <Text className={cn(isSelected && 'text-white')}>{item.text}</Text>
                  </View>
                </Pressable>
              </ContextMenu>
              {item.reactions.love?.includes(ME) && (
                <View
                  className={cn(
                    'absolute -bottom-6 rounded-full bg-card p-px dark:bg-background',
                    item.sender === ME ? 'right-0' : 'left-12',
                  )}
                >
                  <View className="bg-primary/15 dark:bg-primary/50 h-7 w-7 items-center justify-center rounded-full">
                    <Text variant="footnote">😍</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
        {showTime && (
          <View
            className={cn(
              'px-1 pt-0.5',
              item.sender === ME ? 'items-end' : 'pl-14',
              item.reactions.love?.includes(ME) && 'pt-7',
            )}
          >
            <Text variant="caption2" className="font-normal text-muted-foreground">
              {item.time}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

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
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = React.useState('');
  const [showOptions, setShowOptions] = React.useState(true);

  function onContentSizeChange(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    textInputHeight.value = Math.max(
      Math.min(event.nativeEvent.contentSize.height, 280),
      Platform.select({ ios: 24, default: 44 }),
    );
  }

  function onChangeText(text: string) {
    setMessage(text);
    if (showOptions && text.length > 10) {
      setShowOptions(false);
    }
    if (!showOptions && text.length === 0) {
      setShowOptions(true);
    }
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
    if (!showOptions) {
      setShowOptions(true);
    }
  }

  return (
    <View
      className="absolute bottom-0 left-0 right-0 z-50 bg-card dark:bg-background"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-end gap-0.5 py-2 pl-2 pr-4">
        {showOptions || Platform.OS === 'ios' ? (
          <Animated.View
            key="options-container"
            entering={FadeIn.duration(200).delay(150)}
            className="flex-row"
          >
            <Button
              variant="plain"
              size="icon"
              className="ios:rounded-full ios:active:opacity-50 rounded-full opacity-70"
            >
              <Icon
                ios={{ name: 'plus.circle' }}
                materialIcon={{ type: 'MaterialCommunityIcons', name: 'plus-circle-outline' }}
                color={colors.foreground}
              />
            </Button>
            {Platform.OS !== 'ios' && (
              <Button
                variant="plain"
                size="icon"
                className="ios:rounded-full ios:active:opacity-50 rounded-full opacity-70"
              >
                <Icon name="image-outline" color={colors.foreground} />
              </Button>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn}>
            <Button
              onPress={() => setShowOptions(true)}
              variant="plain"
              size="icon"
              className="ios:rounded-full ios:active:opacity-50 rounded-full opacity-70"
            >
              <Icon name="chevron-right" color={colors.foreground} />
            </Button>
          </Animated.View>
        )}

        <Animated.View
          layout={Platform.OS === 'ios' ? undefined : LinearTransition.duration(200)}
          className={cn(
            'bg-muted/25 flex-1 overflow-hidden rounded-3xl',
            Platform.OS === 'ios' && 'dark:bg-muted/50',
          )}
        >
          <TextInput
            placeholder="Text Message"
            style={TEXT_INPUT_STYLE}
            className="ios:py-2.5 min-h-11 flex-1 rounded-3xl py-1.5 pl-3.5 pr-20 text-base leading-6 text-foreground"
            placeholderTextColor={colors.grey2}
            multiline
            onContentSizeChange={onContentSizeChange}
            onChangeText={onChangeText}
            value={message}
          />
        </Animated.View>
        <View className="absolute bottom-2.5 right-4 flex-row">
          <Button size="icon" variant="plain" className="ios:rounded-full rounded-full opacity-60">
            <Icon
              ios={{ name: 'face.smiling' }}
              materialIcon={{ type: 'MaterialCommunityIcons', name: 'emoticon-happy-outline' }}
              size={23}
              color={colors.foreground}
            />
          </Button>
          {message.length > 0 ? (
            <Button
              onPress={sendMessage}
              size="icon"
              variant="plain"
              className="ios:rounded-full ios:pt-1 w-11 rounded-full"
            >
              <Icon name="send" size={22} color={colors.primary} />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="plain"
              className="ios:rounded-full w-11 rounded-full opacity-60"
            >
              <Icon name="microphone" size={22} color={colors.foreground} />
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}

const DROPDOWN_ITEMS = [
  createDropdownItem({ actionKey: 'share', title: 'Share' }),
  createDropdownItem({ actionKey: 'forward', title: 'Forward' }),
];

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
          height: HEADER_HEIGHT + insets.top,
        }}
        className="absolute left-0 right-0 top-0 justify-end bg-card px-3 pb-4 shadow-xl"
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
              <Icon name="file-copy" size={21} color={colors.primary} />
            </Button>
            <Button size="icon" variant="plain">
              <Icon name="trash-can-outline" size={21} color={colors.primary} />
            </Button>
            <DropdownMenu items={DROPDOWN_ITEMS}>
              <Button size="icon" variant="plain" className="rotate-90">
                <Icon name="dots-horizontal" size={24} color={colors.foreground} />
              </Button>
            </DropdownMenu>
          </View>
        </View>
      </Animated.View>
    </Portal>
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
    surprised?: string[];
    sad?: string[];
    angry?: string[];
  };
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
      love: ['Alice'],
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
      love: ['Alice'],
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
  'Monday 13 Jul 2024 · 10:00 AM',

  {
    id: '27',
    sender: 'Bob',
    text: 'Hope you get some rest soon!',
    date: '2024-07-12',
    time: '10:08 AM',
    reactions: {
      love: ['Alice'],
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
      love: ['Alice'],
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
      love: ['Bob'],
    },
    attachments: [],
  },
  'Sunday 12 Jul 2024 · 10:00 AM',

  {
    id: '18',
    sender: 'Bob',
    text: 'Hope you get some rest soon!',
    date: '2024-07-11T10:08:00Z',
    time: '10:08 AM',
    reactions: {
      love: ['Alice'],
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
      love: ['Alice'],
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
      love: ['Bob'],
    },
    attachments: [],
  },
  'Saturday 11 Jul 2024 · 10:00 AM',
];
