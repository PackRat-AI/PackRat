import { type UIMessage, useChat } from '@ai-sdk/react';
import { clientEnvs } from '@packrat/env/expo-client';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type TextUIPart,
} from 'ai';
import * as Burnt from 'burnt';
import { fetch as expoFetch } from 'expo/fetch';
import { AiChatHeader } from 'expo-app/components/ai-chatHeader';
import { Icon } from 'expo-app/components/Icon';
import { TextInput } from 'expo-app/components/TextInput';
import { featureFlags } from 'expo-app/config';
import { aiModeAtom, localModelStatusAtom } from 'expo-app/features/ai/atoms/aiModeAtoms';
import {
  clearChatMessages,
  loadChatMessages,
  saveChatMessages,
} from 'expo-app/features/ai/atoms/chatStorageAtoms';
import { ChatBubble } from 'expo-app/features/ai/components/ChatBubble';
import { ErrorState } from 'expo-app/features/ai/components/ErrorState';
import { LocationContext } from 'expo-app/features/ai/components/LocationContext';
import { CustomChatTransport } from 'expo-app/features/ai/lib/CustomChatTransport';
import {
  getLocalModel,
  initLocalModel,
  releaseLocalModel,
} from 'expo-app/features/ai/lib/localModelManager';
import { createLocalTools } from 'expo-app/features/ai/lib/tools';
import { getPackItems, packItemsStore } from 'expo-app/features/packs/store/packItems';
import { packsStore } from 'expo-app/features/packs/store/packs';
import { useActiveLocation } from 'expo-app/features/weather/hooks';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { authClient } from 'expo-app/lib/auth-client';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { getContextualGreeting, getContextualSuggestions } from 'expo-app/utils/chatContextHelpers';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAtomValue } from 'jotai';
import * as React from 'react';
import {
  AppState,
  Dimensions,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
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

  const aiMode = useAtomValue(aiModeAtom);
  const modelStatus = useAtomValue(localModelStatusAtom);

  const context = React.useMemo(
    () => ({
      itemId: params.itemId as string,
      itemName: params.itemName as string,
      packId: params.packId as string,
      packName: params.packName as string,
      contextType: (params.contextType as 'item' | 'pack' | 'general') || 'general',
      location: location ? location.name : undefined,
    }),
    [params.itemId, params.itemName, params.packId, params.packName, params.contextType, location],
  );
  const locationRef = React.useRef(context.location);
  locationRef.current = context.location;

  const { data: _authSession } = authClient.useSession();
  const userId = _authSession?.user?.id ?? '';
  const [input, setInput] = React.useState('');
  const [lastUserMessage, setLastUserMessage] = React.useState('');
  const [previousMessages, setPreviousMessages] = React.useState<UIMessage[]>([]);
  const [isArrowButtonVisible, setIsArrowButtonVisible] = React.useState(false);
  const isLoadingPersistedRef = React.useRef(false);

  const initialMessages = React.useMemo<UIMessage[]>(
    () => [
      {
        id: '1',
        role: 'assistant',
        parts: [{ type: 'text', text: getContextualGreeting(context) }],
      } satisfies UIMessage,
    ],
    [context],
  );

  // Kick off model init check on mount (prepares already-downloaded models).
  // Release the model when the app backgrounds so the llama TurboModule can be
  // properly invalidated — prevents "Timed out waiting for modules to be
  // invalidated" crashes on hot reload and app restart.
  React.useEffect(() => {
    if (!featureFlags.enableLocalAI) return;

    initLocalModel();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        releaseLocalModel();
      } else if (nextState === 'active') {
        // Re-prepare the model when the app comes back to the foreground.
        initLocalModel();
      }
    });

    // In development, release before fast-refresh tears down native modules.
    if (__DEV__) {
      const devModule = module as unknown as { hot?: { dispose: (cb: () => void) => void } };
      devModule.hot?.dispose(() => releaseLocalModel());
    }

    return () => {
      subscription.remove();
    };
  }, []);

  // Keep a ref for context body values so the transport closure stays fresh
  const contextRef = React.useRef(context);
  contextRef.current = context;

  // Build the right transport based on current AI mode.
  // Recreated when aiMode or modelStatus changes (modelStatus drives local readiness).
  const isLocalReady = modelStatus === 'ready';
  const tools = React.useMemo(() => createLocalTools(), []);

  const { transport, transportKey } = React.useMemo(() => {
    if (featureFlags.enableLocalAI && aiMode === 'local' && isLocalReady) {
      const model = getLocalModel();
      if (model) {
        let systemPrompt = `You are PackRat AI, a helpful assistant for hikers and outdoor enthusiasts.
      You help users manage their hiking packs and gear efficiently using ultralight principles.

      Guidelines:
      - Focus on ultralight hiking principles when appropriate
      - For beginners, emphasize safety and comfort over weight savings
      - Always consider weather conditions in your recommendations
      - Suggest multi-purpose items to reduce pack weight
      - Be concise but helpful in your responses
      - Use tools proactively to provide accurate, up-to-date information

      Context:
      - User id is ${userId}
      - Current date is ${new Date().toLocaleString()}`;

        if (contextRef.current.contextType === 'pack' && contextRef.current.packId) {
          systemPrompt += `\n- You are currently helping with a pack with ID: ${contextRef.current.packId}.`;
        } else if (contextRef.current.contextType === 'item' && contextRef.current.itemId) {
          systemPrompt += `\n- You are currently helping with an item with ID: ${contextRef.current.itemId}.`;
        }

        if (contextRef.current.location) {
          systemPrompt += `\n- The current location of the user is: ${contextRef.current.location}.`;
        }

        return {
          transport: new CustomChatTransport({ model, tools, systemPrompt }),
          transportKey: 'local',
        };
      }
    } else {
    }
    return {
      transport: new DefaultChatTransport({
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        api: `${clientEnvs.EXPO_PUBLIC_API_URL}/api/chat`,
        // HttpChatTransport awaits resolve(this.headers) per send, so this
        // function runs each time. Pull the live token from authClient at
        // request time — useSession() resolves asynchronously and useChat
        // captures the transport at mount, so any value baked in earlier
        // (or stashed in a ref) would go stale on rotation.
        headers: async () => {
          const { data } = await authClient.getSession();
          return { Authorization: `Bearer ${data?.session?.token ?? ''}` };
        },
        body: () => ({
          contextType: contextRef.current.contextType,
          itemId: contextRef.current.itemId,
          packId: contextRef.current.packId,
          location: locationRef.current,
          date: new Date().toLocaleString(),
        }),
      }),
      transportKey: 'remote',
    };
  }, [aiMode, isLocalReady, modelStatus, tools, userId]);

  // transportKey forces useChat to remount when the transport type switches,
  // since useChat captures the transport reference on mount and won't update it.
  const { messages, setMessages, error, sendMessage, stop, status, addToolOutput } = useChat({
    id: transportKey,
    transport,
    onError: (error: Error) => console.log(error, 'ERROR'),
    experimental_throttle: 200,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;

      if (toolCall.toolName === 'getPackDetails') {
        const { packId } = toolCall.input as { packId: string };
        const pack = packsStore.get()[packId];
        if (!pack || pack.deleted) {
          addToolOutput({
            tool: 'getPackDetails',
            toolCallId: toolCall.toolCallId,
            output: { success: false, error: 'Pack not found' },
          });
          return;
        }
        const items = getPackItems(packId);
        const categories = Array.from(new Set(items.map((i) => i.category || 'Uncategorized')));
        addToolOutput({
          tool: 'getPackDetails',
          toolCallId: toolCall.toolCallId,
          output: { success: true, data: { ...pack, items, categories } },
        });
        return;
      }

      if (toolCall.toolName === 'getPackItemDetails') {
        const { itemId } = toolCall.input as { itemId: string };
        const item = packItemsStore.get()[itemId];
        if (!item || item.deleted) {
          addToolOutput({
            tool: 'getPackItemDetails',
            toolCallId: toolCall.toolCallId,
            output: { success: false, error: 'Item not found' },
          });
          return;
        }
        addToolOutput({
          tool: 'getPackItemDetails',
          toolCallId: toolCall.toolCallId,
          output: { success: true, data: item },
        });
      }
    },
  });

  // Load persisted messages on mount and when context changes
  React.useEffect(() => {
    let isMounted = true;
    isLoadingPersistedRef.current = true;

    loadChatMessages(context)
      .then((persisted) => {
        if (isMounted && persisted && persisted.length > 0) {
          setMessages(persisted);
        }
      })
      .catch((error) => {
        console.error('Failed to load persisted messages:', error);
      })
      .finally(() => {
        if (isMounted) {
          isLoadingPersistedRef.current = false;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [context, setMessages]);

  // Save messages whenever they change with debouncing to reduce storage I/O
  React.useEffect(() => {
    if (isLoadingPersistedRef.current || messages.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveChatMessages({ context, messages });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [messages, context]);

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollToBottom = React.useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd();
    }, 100);
  }, []);

  const handleSubmit = (text?: string) => {
    const messageText = text || input;

    // Guard: local mode but model not ready
    if (featureFlags.enableLocalAI && aiMode === 'local' && modelStatus !== 'ready') {
      const toastTitle =
        modelStatus === 'downloading'
          ? t('ai.modelStillDownloading')
          : modelStatus === 'preparing' || modelStatus === 'checking'
            ? t('ai.modelStillLoading')
            : t('ai.modelNotReady');
      Burnt.toast({ title: toastTitle, preset: 'error' });
      return;
    }

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

  const handleClear = React.useCallback(async () => {
    await clearChatMessages(context);
    setMessages(initialMessages);
  }, [context, initialMessages, setMessages]);

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
      <Stack.Screen
        options={{
          header: () => <AiChatHeader onClear={handleClear} />,
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
            <View
              style={{
                height: Platform.OS === 'ios' ? insets.top + 52 : HEADER_HEIGHT + insets.top,
              }}
            />
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
          {status === 'error' && (
            <ErrorState error={error} onRetry={() => handleRetry()} onClear={handleClear} />
          )}
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
          handleInputChange={setInput}
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
