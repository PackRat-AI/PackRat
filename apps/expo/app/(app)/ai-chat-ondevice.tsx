import { type UIMessage, useChat } from '@ai-sdk/react';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { fetch as expoFetch } from 'expo/fetch';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { ChatBubble } from 'expo-app/features/ai/components/ChatBubble';
import { ErrorState } from 'expo-app/features/ai/components/ErrorState';
import { LocationContext } from 'expo-app/features/ai/components/LocationContext';
import { OnDeviceAIStatus } from 'expo-app/features/ai/components/OnDeviceAIStatus';
import { useOnDeviceAI } from 'expo-app/features/ai/hooks/useOnDeviceAI';
import { OnDeviceChatTransport } from 'expo-app/features/ai/providers/on-device-chat-transport';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useActiveLocation } from 'expo-app/features/weather/hooks';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
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
  damping: 20,
  stiffness: 300,
};

export default function OnDeviceAIChat() {
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const textInputHeight = useSharedValue(17);
  const params = useLocalSearchParams();
  const { activeLocation } = useActiveLocation();
  const [location, setLocation] = React.useState<WeatherLocation | null>(activeLocation);
  const [preferOnDevice, setPreferOnDevice] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { isOnDeviceAvailable, recommendedProvider } = useOnDeviceAI();

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

  // Create custom transport that supports on-device AI
  const transport = React.useMemo(() => {
    return new OnDeviceChatTransport({
      preferOnDevice: preferOnDevice && isOnDeviceAvailable,
      fallbackToCloud: true,
      onDeviceConfig: {
        fallbackToCloud: true,
        mlcOptions: {
          modelId: 'Llama-3.2-3B-Instruct',
          downloadProgressCallback: (progress) => {
            console.log('Model download progress:', progress);
          },
        },
      },
      cloudConfig: {
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
      },
    });
  }, [
    preferOnDevice,
    isOnDeviceAvailable,
    token,
    context.contextType,
    context.itemId,
    context.packId,
  ]);

  const [input, setInput] = React.useState('');
  const [_lastUserMessage, setLastUserMessage] = React.useState('');
  const [_previousMessages, setPreviousMessages] = React.useState<UIMessage[]>([]);
  const [isArrowButtonVisible, setIsArrowButtonVisible] = React.useState(false);
  const { messages, setMessages, error, sendMessage, stop, status } = useChat({
    transport,
    onError: (error: Error) => console.log(error, 'ERROR'),
    onFinish: (message) => {
      setLastUserMessage('');
      setPreviousMessages((prev) => [...prev, message]);
    },
  });

  const isLoading = status === 'in_progress';

  const toolbarHeightStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        progress.value,
        [0, 1],
        [52 + insets.bottom, insets.bottom + textInputHeight.value - 2],
      ),
    };
  });

  const handleSubmit = React.useCallback(() => {
    if (!input.trim()) return;

    setLastUserMessage(input);
    sendMessage({ content: input, role: 'user' });
    setInput('');
  }, [input, sendMessage]);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  React.useEffect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, scrollToBottom]);

  const suggestions = getContextualSuggestions(context);
  const greeting = getContextualGreeting(context);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isScrolledUp = contentOffset.y < contentSize.height - layoutMeasurement.height - 50;
    setIsArrowButtonVisible(isScrolledUp && status === 'ready');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <KeyboardAvoidingView
        style={[
          ROOT_STYLE,
          {
            backgroundColor: isDarkColorScheme ? colors.background : colors.card,
          },
        ]}
        behavior="padding"
      >
        {/* Custom Header with On-Device AI Status */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={100}
            style={{
              position: 'absolute',
              zIndex: 50,
              top: 0,
              left: 0,
              right: 0,
              paddingTop: insets.top,
            }}
          >
            <View className="flex-row items-center justify-between px-4 pb-2">
              <View className="flex-row items-center">
                <Button
                  variant="plain"
                  size="icon"
                  onPress={() => {
                    /* navigation back */
                  }}
                >
                  <Icon size={30} color={colors.primary} name="chevron-left" />
                </Button>
              </View>
              <View className="items-center">
                <Text variant="title3" className="text-center">
                  PackRat AI {recommendedProvider && `(${recommendedProvider})`}
                </Text>
                <Text variant="caption2" className="text-muted-foreground">
                  {isOnDeviceAvailable ? 'On-device Ready' : 'Cloud-based'}
                </Text>
              </View>
              <Button variant="plain" size="icon" onPress={() => setShowSettings(!showSettings)}>
                <Icon size={28} color={colors.primary} name="settings" />
              </Button>
            </View>
          </BlurView>
        ) : (
          <View
            className="absolute left-0 right-0 top-0 z-50 justify-end bg-card dark:bg-background"
            style={{ paddingTop: insets.top, height: HEADER_HEIGHT + insets.top }}
          >
            <View
              style={{ height: HEADER_HEIGHT }}
              className="flex-row items-center justify-between gap-2 px-3 pb-2"
            >
              <View className="flex-row items-center">
                <Button
                  variant="plain"
                  size="icon"
                  className="opacity-70"
                  onPress={() => {
                    /* navigation back */
                  }}
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
              <View className="flex-1 items-center">
                <Text className="text-lg font-medium">
                  PackRat AI {recommendedProvider && `(${recommendedProvider})`}
                </Text>
                <Text variant="caption2" className="text-muted-foreground">
                  {isOnDeviceAvailable ? 'On-device Ready' : 'Cloud-based'}
                </Text>
              </View>
              <Button variant="plain" size="icon" onPress={() => setShowSettings(!showSettings)}>
                <Icon size={24} color={colors.foreground} name="settings" />
              </Button>
            </View>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerClassName="min-h-full"
          style={{
            paddingTop: HEADER_HEIGHT + insets.top + 16,
          }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* On-Device AI Settings Panel */}
          {showSettings && (
            <View className="mx-4 mb-4">
              <OnDeviceAIStatus />

              <View className="mt-3 p-3 bg-card rounded-lg">
                <Text variant="subhead" className="font-medium mb-2">
                  AI Preferences
                </Text>

                <TouchableOpacity
                  className="flex-row items-center justify-between py-2"
                  onPress={() => setPreferOnDevice(!preferOnDevice)}
                >
                  <View className="flex-1">
                    <Text variant="callout">Prefer On-Device AI</Text>
                    <Text variant="caption2" className="text-muted-foreground">
                      Use local AI when available for better privacy
                    </Text>
                  </View>
                  <Icon
                    name={preferOnDevice ? 'checkmark-circle' : 'circle'}
                    size={20}
                    color={preferOnDevice ? colors.success : colors.muted.foreground}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Location Context */}
          <LocationContext
            location={location}
            onLocationChange={setLocation}
            contextType={context.contextType}
          />

          {/* Chat Messages */}
          <View className="flex-1 px-4 pb-4">
            {error && (
              <View className="mb-4">
                <ErrorState error={error} onRetry={() => window.location.reload()} />
              </View>
            )}

            {messages.length === 0 && !isLoading && (
              <View className="flex-1 justify-center items-center py-8">
                <Icon name="chatbox" size={48} color={colors.muted.foreground} />
                <Text variant="title2" className="text-center mt-4 mb-2">
                  {greeting}
                </Text>
                <Text variant="callout" className="text-muted-foreground text-center mb-6">
                  {context.contextType === 'general'
                    ? 'Ask me anything about outdoor activities, gear, or planning your next adventure.'
                    : `Get personalized suggestions for your ${context.contextType}.`}
                </Text>

                {/* Quick Suggestions */}
                <View className="flex-row flex-wrap justify-center gap-2">
                  {suggestions.slice(0, 3).map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setInput(suggestion);
                        handleSubmit();
                      }}
                    >
                      <Text variant="caption1">{suggestion}</Text>
                    </Button>
                  ))}
                </View>
              </View>
            )}

            {messages.map((message, index) => (
              <ChatBubble
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
                onCopy={(text) => {
                  // Handle copy functionality
                  console.log('Copy:', text);
                }}
              />
            ))}

            {isLoading && (
              <View className="flex-row items-center gap-2 py-4">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text variant="caption1" className="text-muted-foreground">
                  {recommendedProvider ? `${recommendedProvider} is thinking...` : 'Thinking...'}
                </Text>
              </View>
            )}
          </View>
          <Animated.View style={[toolbarHeightStyle, { marginBottom: 20 }]} />
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <Composer
          textInputHeight={textInputHeight}
          input={input}
          handleInputChange={setInput}
          handleSubmit={handleSubmit}
          stop={stop}
          isLoading={isLoading}
          placeholder={
            context.contextType === 'general'
              ? 'Ask anything outdoors'
              : `Ask about this ${context.contextType === 'item' ? 'item' : 'pack'}...`
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
  const textInputRef = React.useRef<TextInput>(null);

  function onContentSizeChange(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    textInputHeight.value = Math.max(
      Math.min(event.nativeEvent.contentSize.height, 280),
      Platform.select({ ios: 20, default: 38 }),
    );
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: textInputHeight.value + 24,
    } as TextStyle;
  });

  return (
    <View
      className="mx-4 mb-2 rounded-full border border-border bg-card px-4 py-2"
      style={{
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View className="flex-row items-end gap-3">
        <Animated.View style={[animatedStyle]} className="flex-1 justify-center">
          <TextInput
            ref={textInputRef}
            className="text-base text-foreground"
            style={{
              color: colors.foreground,
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.muted.foreground}
            value={input}
            onChangeText={handleInputChange}
            onContentSizeChange={onContentSizeChange}
            onSubmitEditing={handleSubmit}
            multiline
            textAlignVertical="center"
            returnKeyType="send"
            blurOnSubmit={false}
          />
        </Animated.View>

        {isLoading ? (
          <Button variant="ghost" size="icon" onPress={stop}>
            <View className="h-6 w-6 rounded-full bg-destructive items-center justify-center">
              <View className="h-2 w-2 rounded-full bg-white" />
            </View>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onPress={handleSubmit} disabled={!input.trim()}>
            <Icon
              name="arrow-up"
              size={20}
              color={input.trim() ? colors.primary : colors.muted.foreground}
            />
          </Button>
        )}
      </View>
    </View>
  );
}
