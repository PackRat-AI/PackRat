import { Text } from '@packrat/ui/nativewindui';
import type { ToolUIPart, UIMessage } from 'ai';
import { Markdown } from 'expo-app/components/Markdown';
import { ReportButton } from 'expo-app/features/ai/components/ReportButton';
import { cn } from 'expo-app/lib/cn';
import { formatAIResponse } from 'expo-app/utils/format-ai-response';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { ToolInvocationRenderer } from './ToolInvocationRenderer';

const BORDER_CURVE: ViewStyle = {
  borderCurve: 'continuous',
};

interface ChatBubbleProps {
  item: UIMessage;
  userQuery?: string;
}

export function ChatBubble({ item, userQuery }: ChatBubbleProps) {
  const isAI = item.role === 'assistant';

  return (
    <View
      className={cn('justify-center px-2 pb-3.5', isAI ? 'items-start pr-4' : 'items-end pl-16')}
    >
      <View>
        <View>
          <View
            className={cn(
              'absolute bottom-0 items-center justify-center',
              isAI ? '-left-2 ' : '-right-2.5',
            )}
          >
            {Platform.OS === 'ios' && (
              <>
                <View
                  className={cn(
                    'h-5 w-5 rounded-full',
                    !isAI
                      ? 'bg-primary'
                      : Platform.OS === 'ios'
                        ? 'bg-background dark:bg-muted'
                        : 'bg-background dark:bg-muted-foreground',
                  )}
                />
                <View
                  className={cn(
                    'absolute h-5 w-5 rounded-full bg-card dark:bg-background',
                    !isAI ? '-right-2' : 'right-2',
                  )}
                />
                <View
                  className={cn(
                    'absolute h-5 w-5 -translate-y-1 rounded-full bg-card dark:bg-background',
                    !isAI ? '-right-2' : 'right-2',
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
                  'px-2 py-1.5 dark:bg-muted-foreground',
                  Platform.OS === 'ios' && 'dark:bg-muted',
                  !isAI && 'bg-primary dark:bg-primary',
                )}
              >
                {item.parts.map((part, idx) => {
                  const key = `${part.type}-${idx}`;
                  if (part.type === 'text')
                    return isAI ? (
                      <Markdown>{formatAIResponse(part.text)}</Markdown>
                    ) : (
                      <Text key={key} className={cn(!isAI && 'text-white')}>
                        {part.text}
                      </Text>
                    );

                  if (isAI && part.type.startsWith('tool-'))
                    return (
                      <View key={key} className="mt-2">
                        <ToolInvocationRenderer
                          key={(part as ToolUIPart).toolCallId}
                          toolInvocation={part as ToolUIPart}
                        />
                      </View>
                    );
                })}
              </View>
            </Pressable>

            {isAI && userQuery && (
              <View className="mt-1 pl-2">
                <ReportButton
                  messageId={item.id}
                  aiResponse={item.parts.find((p) => p.type === 'text')?.text ?? ''}
                  userQuery={userQuery}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
