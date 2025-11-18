import { type UIMessage, useChat } from '@ai-sdk/react';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { DefaultChatTransport, type TextUIPart } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { ChatBubble } from 'expo-app/features/ai/components/ChatBubble';
import { ErrorState } from 'expo-app/features/ai/components/ErrorState';
import { LocationContext } from 'expo-app/features/ai/components/LocationContext';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useActiveLocation } from 'expo-app/features/weather/hooks';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { getContextualGreeting, getContextualSuggestions } from 'expo-app/utils/chatContextHelpers';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAtomValue } from 'jotai';
import * as React from 'react';
import {
  Dimensions,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
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
  const params = useLocalSearchParams();
  const { activeLocation } = useActiveLocation();
  const [location, setLocation] = React.useState<WeatherLocation | null>(activeLocation);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { t } = useTranslation();

  const context = {
    itemId: params.itemId as string,
    itemName: params.itemName as string,
    packId: params.packId as string,
    packName: params.packName as string,
    contextType: (params.contextType as 'item' | 'pack' | 'general') || 'general',
    location: location ? location.name : undefined,
  };
  const locationRef = React.useRef(context.location);
  locationRef.current = context.location;

  const token = useAtomValue(tokenAtom);
  const [input, setInput] = React.useState('');
  const [lastUserMessage, setLastUserMessage] = React.useState('');
  const [previousMessages, setPreviousMessages] = React.useState<UIMessage[]>([]);
  const [isArrowButtonVisible, setIsArrowButtonVisible] = React.useState(false);
  const { messages, setMessages, error, sendMessage, stop, status } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: `${clientEnvs.EXPO_PUBLIC_API_URL}/api/chat`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: () => ({
        contextType: context.contextType,
        itemId: context.itemId,
        packId: context.packId,
        location: locationRef.current,
        date: new Date().toLocaleString(),
      }),
    }),
    onError: (error: Error) => console.log(error, 'ERROR'),
    experimental_throttle: 200, // Throttle updates to 200ms to prevent UI freezes (e.g. unresponsive button presses)
    messages: [
      {
        id: '1',
        role: 'assistant',
        parts: [{ type: 'text', text: getContextualGreeting(context) }],
      } as UIMessage,
    ],
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollToBottom = React.useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd();
    }, 100);
  }, []);

  const handleSubmit = (text?: string) => {
    const messageText = text || input;
    setLastUserMessage(messageText);
    setPreviousMessages(messages);
    sendMessage({ text: messageText });
    setInput('');
    scrollToBottom();
  };

  const handleRetry = () => {
    setMessages(previousMessages);
    sendMessage({ text: lastUserMessage });
  };

  const toolbarHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [52 + insets.bottom, insets.bottom + textInputHeight.value - 2],
    ),
  }));

  const listLayoutRef = React.useRef({
    offset: 0,
    containerHeight: 0,
    contentHeight: 0,
  });

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    listLayoutRef.current.offset = e.nativeEvent.contentOffset.y;
    setIsArrowButtonVisible(
      listLayoutRef.current.contentHeight >
        listLayoutRef.current.containerHeight + listLayoutRef.current?.offset + HEADER_HEIGHT + 5,
    );
  };
  const onLayout = (e: { nativeEvent: { layout: { height: number } } }) => {
    listLayoutRef.current.containerHeight = e.nativeEvent.layout.height;
    setIsArrowButtonVisible(
      listLayoutRef.current.contentHeight >
        listLayoutRef.current.containerHeight + listLayoutRef.current?.offset + HEADER_HEIGHT + 5,
    );
  };
  const onContentSizeChange = (_contentWidth: number, contentHeight: number) => {
    listLayoutRef.current.contentHeight = contentHeight;
    setIsArrowButtonVisible(
      contentHeight >
        listLayoutRef.current.containerHeight + listLayoutRef.current?.offset + HEADER_HEIGHT + 5,
    );
  };

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
        <ScrollView
          ref={scrollViewRef}
          onLayout={onLayout}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          scrollIndicatorInsets={{
            bottom: HEADER_HEIGHT + 10,
            top: insets.bottom + 2,
          }}
        >
          <View>
            <View style={{ height: HEADER_HEIGHT + insets.top }} />
            <LocationContext location={location} onSetLocation={setLocation} />
            <DateSeparator
              date={new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            />
          </View>

          {messages.map((item, index) => {
            // Get the user query for this AI response
            let userQuery: TextUIPart['text'] | undefined;
            if (item.role === 'assistant' && index > 1) {
              const userMessage = messages[index - 1];
              userQuery = userMessage?.parts.find((p) => p.type === 'text')?.text;
            }

            return (
              <ChatBubble
                key={item.id}
                item={item}
                userQuery={userQuery}
                isLast={index === messages.length - 1}
                status={status}
              />
            );
          })}

          {status === 'submitted' && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              className="self-start ml-4 mb-8"
            />
          )}
          {status === 'error' && <ErrorState error={error} onRetry={() => handleRetry()} />}
          {messages.length < 2 && (
            <View className="pl-4 pr-16">
              <Text className="mb-2 text-xs text-muted-foreground mt-0">{t('ai.suggestions')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {getContextualSuggestions(context).map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    onPress={() => handleSubmit(suggestion)}
                    className="mb-2 rounded-3xl border border-border bg-card px-3 py-2"
                  >
                    <Text className="text-sm text-foreground">{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <Animated.View style={[toolbarHeightStyle, { marginBottom: 20 }]} />
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <Composer
          textInputHeight={textInputHeight}
          input={input}
          handleInputChange={setInput} // Pass the setter directly.
          handleSubmit={() => {
            handleSubmit();
          }}
          stop={stop}
          isLoading={isLoading}
          placeholder={
            context.contextType === 'general'
              ? t('ai.askAnythingOutdoors')
              : context.contextType === 'item' 
                ? t('ai.askAboutItem')
                : t('ai.askAboutPack')
          }
        />
      </KeyboardStickyView>
      {isArrowButtonVisible && status === 'ready' && (
        <TouchableOpacity
          onPress={scrollToBottom}
          className="absolute bottom-20 right-4 rounded-full bg-gray-200 p-3 mb-5 shadow-lg"
        >
          <Icon name="arrow-down" size={20} color="black" />
        </TouchableOpacity>
      )}
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
  stop,
  isLoading,
  placeholder,
}: {
  textInputHeight: SharedValue<number>;
  input: string;
  handleInputChange: (text: string) => void;
  handleSubmit: () => void;
  stop: () => void;
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
        />
        <View className="absolute bottom-3 right-5">
          {isLoading ? (
            <Button onPress={stop} size="icon" variant="primary" className="h-7 w-7 rounded-full">
              <Icon name="stop" size={18} color="white" />
            </Button>
          ) : (
            <Button
              onPress={handleSubmit}
              disabled={!input.length}
              size="icon"
              className="ios:rounded-full h-7 w-7 rounded-full"
            >
              <Icon name="arrow-up" size={18} color="white" />
            </Button>
          )}
        </View>
      </View>
    </BlurView>
  );
}
