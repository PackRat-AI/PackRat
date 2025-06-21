import { useChat } from '@ai-sdk/react';
import { Icon } from '@roninoss/icons';
import { FlashList } from '@shopify/flash-list';
import { BlurView } from 'expo-blur';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { fetch as expoFetch } from 'expo/fetch';
import * as React from 'react';
import {
  Dimensions,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  type TextInputContentSizeChangeEventData,
  type TextStyle,
  type ViewStyle,
  TouchableOpacity,
  View,
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
import { Button } from 'nativewindui/Button';
import { Text } from 'nativewindui/Text';
import { LocationSelector } from 'expo-app/features/weather/components/LocationSelector';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import { formatAIResponse } from 'expo-app/utils/format-ai-response';
import { getContextualGreeting, getContextualSuggestions } from 'expo-app/utils/chatContextHelpers';
import { useAtomValue } from 'jotai';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useActiveLocation } from 'expo-app/features/weather/hooks';

const USER = 'User';
const AI = 'PackRat AI';
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

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const HEADER_POSITION_STYLE: ViewStyle = {
  position: 'absolute',
  zIndex: 50,
  top: 0,
  left: 0,
  right: 0,
};

export default function AIChat() {
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const textInputHeight = useSharedValue(17);
  const translateX = useSharedValue(0);
  const previousTranslateX = useSharedValue(0);
  const initialTouchLocation = useSharedValue<{ x: number; y: number } | null>(null);
  const params = useLocalSearchParams();
  const [showSuggestions, setShowSuggestions] = React.useState(true);
  const { activeLocation } = useActiveLocation();
  const listRef = React.useRef<FlashList<any> | null>(null);

  // Extract context from params
  const context = {
    itemId: params.itemId as string,
    itemName: params.itemName as string,
    packId: params.packId as string,
    packName: params.packName as string,
    contextType: (params.contextType as 'item' | 'pack' | 'general') || 'general',
    location: activeLocation ? activeLocation.name : undefined,
  };

  // Get contextual information
  const contextName =
    context.contextType === 'item'
      ? context.itemName
      : context.contextType === 'pack'
        ? context.packName
        : undefined;

  const token = useAtomValue(tokenAtom);
  // Call the chat hook at the top level.
  const { messages, error, handleInputChange, input, setInput, handleSubmit, isLoading } = useChat({
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    api: `${process.env.EXPO_PUBLIC_API_URL}/api/chat`,
    onError: (error: Error) => console.log(error, 'ERROR'),
    body: {
      contextType: context.contextType,
      itemId: context.itemId,
      packId: context.packId,
      location: context.location,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    initialMessages: [
      {
        id: '1',
        role: 'assistant',
        content: getContextualGreeting(context),
      },
    ],
    onFinish: () => {
      // Hide suggestions after user sends a message
      setShowSuggestions(false);
    },
  });

  const handleSuggestionPress = (suggestion: string) => {
    setInput(suggestion);
    handleSubmit();
    setShowSuggestions(false);
  };

  const toolbarHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [52 + insets.bottom, insets.bottom + textInputHeight.value - 2]
    ),
  }));

  const pan = Gesture.Pan()
    .minDistance(10)
    .onBegin((evt) => {
      initialTouchLocation.value = { x: evt.x, y: evt.y };
    })
    .onStart(() => {
      previousTranslateX.value = translateX.value;
    })
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

  // Format messages for the UI.
  const chatMessages = React.useMemo(() => {
    if (messages.length === 0) {
      return [];
    }

    const formattedMessages = messages.map((message) => {
      const now = new Date();
      return {
        id: message.id,
        sender: message.role === 'user' ? USER : AI,
        text: message.content,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        reactions: {},
        attachments: [],
      };
    });
    // Add a date separator at the beginning.
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return [today, ...formattedMessages];
  }, [messages]);

  React.useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd());
  }, [chatMessages]);

  return (
    <>
      <Stack.Screen />
      <GestureDetector gesture={pan}>
        <KeyboardAvoidingView
          style={[
            ROOT_STYLE,
            { backgroundColor: isDarkColorScheme ? colors.background : colors.card },
          ]}
          behavior="padding">
          <FlashList
            // inverted
            ref={listRef}
            estimatedItemSize={70}
            ListHeaderComponent={
              <View>
                <View style={{ height: HEADER_HEIGHT + insets.top }} />
                <LocationSelector />
              </View>
            }
            ListFooterComponent={
              <>
                {showSuggestions && messages.length <= 2 && (
                  <View className="px-4 py-4">
                    <Text className="mb-2 text-xs text-muted-foreground">SUGGESTIONS</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {getContextualSuggestions(context).map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => handleSuggestionPress(suggestion)}
                          className="mb-2 rounded-full border border-border bg-card px-3 py-2">
                          <Text className="text-sm text-foreground">{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <Animated.View style={toolbarHeightStyle} />
              </>
            }
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollIndicatorInsets={{ bottom: HEADER_HEIGHT + 10, top: insets.bottom + 2 }}
            data={chatMessages}
            renderItem={({ item, index }) => {
              if (typeof item === 'string') {
                return <DateSeparator date={item} />;
              }
              const nextMessage = chatMessages[index - 1];
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
          {error && (
            <View className="absolute bottom-20 left-0 right-0 items-center">
              <View className="bg-destructive/90 mx-4 rounded-lg px-4 py-2">
                <Text className="text-center text-white">{error.message}</Text>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </GestureDetector>
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <Composer
          textInputHeight={textInputHeight}
          input={input}
          handleInputChange={setInput} // Pass the setter directly.
          handleSubmit={() => {
            handleSubmit();
            setShowSuggestions(false);
          }}
          isLoading={isLoading}
          placeholder={
            context.contextType == 'general'
              ? 'Ask anything outdoors'
              : `Ask about this ${context.contextType == 'item' ? 'item' : 'pack'}...`
          }
        />
      </KeyboardStickyView>
    </>
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

const BORDER_CURVE: ViewStyle = {
  borderCurve: 'continuous',
};

function ChatBubble({
  item,
  isSameNextSender,
  translateX,
}: {
  item: {
    id: string;
    sender: string;
    text: string;
    date: string;
    time: string;
    reactions: Record<string, string[] | undefined>;
    attachments: { type: string; url: string }[];
  };
  isSameNextSender: boolean;
  translateX: SharedValue<number>;
}) {
  const { colors } = useColorScheme();
  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const dateStyle = useAnimatedStyle(() => ({
    width: 75,
    position: 'absolute',
    right: 0,
    paddingLeft: 8,
    transform: [{ translateX: interpolate(translateX.value, [-75, 0], [0, 75]) }],
  }));
  const isAI = item.sender === AI;

  return (
    <View
      className={cn(
        'justify-center px-2 pb-3.5',
        isSameNextSender ? 'pb-1' : 'pb-3.5',
        isAI ? 'items-start pr-16' : 'items-end pl-16'
      )}>
      <Animated.View style={!isAI ? rootStyle : undefined}>
        <View>
          <View
            className={cn(
              'absolute bottom-0 items-center justify-center',
              isAI ? '-left-2 ' : '-right-2.5'
            )}>
            {Platform.OS === 'ios' && (
              <>
                <View
                  className={cn(
                    'h-5 w-5 rounded-full',
                    !isAI
                      ? 'bg-primary'
                      : Platform.OS === 'ios'
                        ? 'bg-background dark:bg-muted'
                        : 'bg-background dark:bg-muted-foreground'
                  )}
                />
                <View
                  className={cn(
                    'absolute h-5 w-5 rounded-full bg-card dark:bg-background',
                    !isAI ? '-right-2' : 'right-2'
                  )}
                />
                <View
                  className={cn(
                    'absolute h-5 w-5 -translate-y-1 rounded-full bg-card dark:bg-background',
                    !isAI ? '-right-2' : 'right-2'
                  )}
                />
              </>
            )}
          </View>
          <View>
            <Pressable>
              <View
                style={BORDER_CURVE}
                className={cn(
                  'rounded-2xl bg-background px-3 py-1.5 dark:bg-muted-foreground',
                  Platform.OS === 'ios' && 'dark:bg-muted',
                  !isAI && 'bg-primary dark:bg-primary'
                )}>
                <Text className={cn(!isAI && 'text-white')}>
                  {isAI ? formatAIResponse(item.text) : item.text}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
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
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  placeholder,
}: {
  textInputHeight: SharedValue<number>;
  input: string;
  handleInputChange: (text: string) => void;
  handleSubmit: () => void;
  isLoading: boolean;
  placeholder: string;
}) {
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();

  function onContentSizeChange(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    textInputHeight.value = Math.max(
      Math.min(event.nativeEvent.contentSize.height, 280),
      Platform.select({ ios: 20, default: 38 })
    );
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
      ]}>
      <View className="flex-row items-end gap-2 px-4 py-2">
        <TextInput
          placeholder={placeholder}
          style={TEXT_INPUT_STYLE}
          className="ios:pt-[7px] ios:pb-1 min-h-9 flex-1 rounded-[18px] border border-border bg-background py-1 pl-3 pr-8 text-base leading-5 text-foreground"
          placeholderTextColor={colors.grey2}
          multiline
          onContentSizeChange={onContentSizeChange}
          onChangeText={handleInputChange}
          value={input}
          editable={!isLoading}
        />
        <View className="absolute bottom-3 right-5">
          {isLoading ? (
            <View className="h-7 w-7 items-center justify-center">
              <Text className="text-xs text-primary">...</Text>
            </View>
          ) : input.length > 0 ? (
            <Button
              onPress={handleSubmit}
              size="icon"
              className="ios:rounded-full h-7 w-7 rounded-full">
              <Icon name="arrow-up" size={18} color="white" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="plain"
              className="ios:rounded-full h-7 w-7 rounded-full opacity-40">
              <Icon name="arrow-up" size={20} color={colors.foreground} />
            </Button>
          )}
        </View>
      </View>
    </BlurView>
  );
}
