import { type Message, useChat } from '@ai-sdk/react';
import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { FlashList } from '@shopify/flash-list';
import { fetch as expoFetch } from 'expo/fetch';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { ChatBubble } from 'expo-app/features/ai/components/ChatBubble';
import type { ChatMessage } from 'expo-app/features/ai/types';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { LocationSelector } from 'expo-app/features/weather/components/LocationSelector';
import { useActiveLocation } from 'expo-app/features/weather/hooks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { getContextualGreeting, getContextualSuggestions } from 'expo-app/utils/chatContextHelpers';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAtomValue } from 'jotai';
import * as React from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  type NativeSyntheticEvent,
  Platform,
  TextInput,
  type TextInputContentSizeChangeEventData,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertDefined } from 'expo-app/utils/typeAssertions';

const USER = 'User';
const AI = 'PackRat AI';
const HEADER_HEIGHT = Platform.select({ ios: 88, default: 64 });
const _dimensions = Dimensions.get('window');

const ROOT_STYLE: ViewStyle = {
  flex: 1,
  minHeight: 2,
};

const _SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const _HEADER_POSITION_STYLE: ViewStyle = {
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
  const params = useLocalSearchParams();
  const [showSuggestions, setShowSuggestions] = React.useState(true);
  const { activeLocation } = useActiveLocation();
  const listRef = React.useRef<FlashList<string | ChatMessage>>(null);

  // Extract context from params
  const context = {
    itemId: params.itemId as string,
    itemName: params.itemName as string,
    packId: params.packId as string,
    packName: params.packName as string,
    contextType: (params.contextType as 'item' | 'pack' | 'general') || 'general',
    location: activeLocation ? activeLocation.name : undefined,
  };

  const token = useAtomValue(tokenAtom);
  // Call the chat hook at the top level.
  const { messages, error, input, setInput, handleSubmit, isLoading } = useChat({
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    api: `${clientEnvs.EXPO_PUBLIC_API_URL}/api/chat`,
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

  React.useEffect(() => {
    if (error) {
      Alert.alert(error.message);
    }
  }, [error]);

  const handleSuggestionPress = (suggestion: string) => {
    setInput(suggestion);
    handleSubmit();
    setShowSuggestions(false);
  };

  const toolbarHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [52 + insets.bottom, insets.bottom + textInputHeight.value - 2],
    ),
  }));

  // Format messages for the UI
  const chatMessages = React.useMemo(() => {
    if (messages.length === 0) {
      return [];
    }

    const formattedMessages = messages.map((message, _index) => {
      const now = new Date();
      const formattedMessage = {
        sender: message.role === 'user' ? USER : AI,
        text: message.content,
        date: now.toISOString().split('T')[0] as string,
        time: now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        ...message,
      };

      return formattedMessage;
    });

    // Add a date separator at the beginning
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return [today, ...formattedMessages];
  }, [messages]);

  React.useEffect(() => {
    const scrollToBottom = () => {
      listRef.current?.scrollToOffset({ offset: 999999, animated: true });
    };

    scrollToBottom();

    const keyboardListener = Keyboard.addListener('keyboardDidShow', scrollToBottom);

    return () => {
      keyboardListener.remove();
    };
  }, []);

  return (
    <>
      <Stack.Screen />
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
                    {getContextualSuggestions(context).map((suggestion) => (
                      <TouchableOpacity
                        key={suggestion}
                        onPress={() => handleSuggestionPress(suggestion)}
                        className="mb-2 rounded-full border border-border bg-card px-3 py-2"
                      >
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
          scrollIndicatorInsets={{
            bottom: HEADER_HEIGHT + 10,
            top: insets.bottom + 2,
          }}
          data={chatMessages}
          renderItem={({ item, index }) => {
            if (typeof item === 'string') {
              return <DateSeparator date={item} />;
            }

            item.parts?.forEach((part) => {
              console.log('part', JSON.stringify(part));
            });

            // Get the user query for this AI response
            let userQuery: Message['content'] | undefined;
            if (item.sender === AI && index > 1) {
              const userMessage = messages[index - 1];
              assertDefined(userMessage);
              userQuery = userMessage.content;
            }

            return <ChatBubble item={item} translateX={translateX} userQuery={userQuery} />;
          }}
        />
      </KeyboardAvoidingView>
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
            context.contextType === 'general'
              ? 'Ask anything outdoors'
              : `Ask about this ${context.contextType === 'item' ? 'item' : 'pack'}...`
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

const _BORDER_CURVE: ViewStyle = {
  borderCurve: 'continuous',
};

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
      Platform.select({ ios: 20, default: 38 }),
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
      ]}
    >
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
              <Icon name="arrow-up" size={20} color={colors.foreground} />
            </Button>
          )}
        </View>
      </View>
    </BlurView>
  );
}
