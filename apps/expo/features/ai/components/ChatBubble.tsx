import { Text } from '@packrat/ui/nativewindui';
import type { ToolUIPart, UIMessage } from 'ai';
import { Markdown } from 'expo-app/components/Markdown';
import { ReportButton } from 'expo-app/features/ai/components/ReportButton';
import { cn } from 'expo-app/lib/cn';
import { formatAIResponse } from 'expo-app/utils/format-ai-response';
import { Pressable, View, type ViewStyle } from 'react-native';
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
    <View className={cn('justify-center px-2 mb-6', isAI ? 'items-start pr-4' : 'items-end pl-16')}>
      <View>
        <View className="items-center justify-center"></View>
        <View>
          <Pressable>
            <View
              style={BORDER_CURVE}
              className={cn(
                'px-2 py-1.5',
                !isAI && 'bg-neutral-200 dark:bg-neutral-700 rounded-2xl',
              )}
            >
              {item.parts.map((part, idx) => {
                const key = `${part.type}-${idx}`;
                if (part.type === 'text')
                  return isAI ? (
                    <Markdown key={key}>{formatAIResponse(part.text)}</Markdown>
                  ) : (
                    <Text key={key}>{part.text}</Text>
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
            <View className="pl-2">
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
  );
}
