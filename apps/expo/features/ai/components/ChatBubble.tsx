import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ContextMenu,
  createContextItem,
  Sheet,
  Text,
  useColorScheme,
  useSheetRef,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { ToolUIPart, UIMessage } from 'ai';
import { Markdown } from 'expo-app/components/Markdown';
import { cn } from 'expo-app/lib/cn';
import { formatAIResponse } from 'expo-app/utils/format-ai-response';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, TouchableOpacity, View, type ViewStyle } from 'react-native';
import Toast from 'react-native-toast-message';
import { ReportModal } from './ReportModal';
import { ToolInvocationRenderer } from './ToolInvocationRenderer';

const BORDER_CURVE: ViewStyle = {
  borderCurve: 'continuous',
};

interface ChatBubbleProps {
  item: UIMessage;
  userQuery?: string;
  isLast: boolean;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
}

export function ChatBubble({ item, userQuery, isLast, status }: ChatBubbleProps) {
  const isAI = item.role === 'assistant';
  const bottomSheetRef = useSheetRef();
  const { colors } = useColorScheme();

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);

  const openBottomSheet = () => {
    bottomSheetRef.current?.present();
  };

  const handleCopyText = useCallback(async () => {
    try {
      const textContent = item.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');

      await Clipboard.setStringAsync(textContent);

      // Provide haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Show success feedback
      Toast.show({
        type: 'success',
        text1: 'Copied',
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to copy text',
      });
    }
  }, [item]);

  const handleReportSuccess = useCallback(() => {
    Toast.show({
      type: 'success',
      text1: 'Report submitted',
    });
  }, []);

  const handleReport = useCallback(() => setIsReportModalVisible(true), []);

  return (
    <View className={cn('justify-center px-2 mb-6', isAI ? 'items-start pr-4' : 'items-end pl-16')}>
      {/* <ContextMenu
        enabled={isAI ? !isLast || status === 'ready' : true}
        className="rounded-md"
        
        items={[
          createContextItem({
            actionKey: 'copy',
            title: 'Copy',
            icon: { name: 'clipboard-outline', color: colors.grey2 },
          }),
          createContextItem({
            actionKey: 'select-text',
            title: 'Select Text',
            icon: { name: 'file-document-outline', color: colors.grey2 },
          }),
          ...(isAI
            ? [
                createContextItem({
                  actionKey: 'report',
                  title: 'Report',
                  icon: { name: 'flag-outline', color: colors.grey2 },
                }),
              ]
            : []),
        ]}
        onItemPress={(item) => {
          console.log(item);
          switch (item.actionKey) {
            case 'copy':
              handleCopyText();
              break;
            case 'select-text':
              openBottomSheet();
              break;
            case 'report':
              handleReport();
              break;
            default:
              break;
          }
        }}
      > */}
      <View
        style={BORDER_CURVE}
        className={cn(
          'px-2',
          isAI ? 'w-full' : 'py-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-2xl',
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
              <View key={key} className="my-2">
                <ToolInvocationRenderer
                  key={(part as ToolUIPart).toolCallId}
                  toolInvocation={part as ToolUIPart}
                />
              </View>
            );
        })}
      </View>
      {/* </ContextMenu> */}

      {isAI && userQuery && (!isLast || status === 'ready') && (
        <>
          <View className="pl-2 flex-row gap-4">
            <TouchableOpacity
              onPress={handleReport}
              className="flex-row gap-1 items-center opacity-70"
            >
              <Icon name="flag-outline" size={14} color={colors.grey2} />
              <Text className="text-xs text-muted-foreground">Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCopyText}
              className="flex-row gap-1 items-center opacity-70"
            >
              <Icon name="clipboard-outline" size={14} color={colors.grey2} />
              <Text className="text-muted-foreground text-xs">Copy</Text>
            </TouchableOpacity>
          </View>

          <ReportModal
            isVisible={isReportModalVisible}
            onClose={() => setIsReportModalVisible(false)}
            messageId={item.id}
            userQuery={userQuery}
            aiResponse={item.parts
              .filter((part) => part.type === 'text')
              .map((part) => part.text)
              .join('\n')}
            onSuccess={handleReportSuccess}
          />
        </>
      )}

      <Sheet ref={bottomSheetRef} snapPoints={['100%']} index={0}>
        <BottomSheetScrollView className="flex-1 px-4" style={{ flex: 1 }}>
          <View>
            <Text variant="heading" className="text-center mb-6">
              Select Text
            </Text>

            <View className="mb-6">
              <Text selectable>
                {isAI
                  ? formatAIResponse(
                      item.parts
                        .filter((part) => part.type === 'text')
                        .map((part) => part.text)
                        .join('\n'),
                    )
                  : item.parts
                      .filter((part) => part.type === 'text')
                      .map((part) => part.text)
                      .join('\n')}
              </Text>
            </View>
          </View>
        </BottomSheetScrollView>
      </Sheet>
    </View>
  );
}
