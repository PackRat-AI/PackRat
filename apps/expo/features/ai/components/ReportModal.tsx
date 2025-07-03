import { Button } from '@packrat/ui/nativewindui/Button';
import { Text } from '@packrat/ui/nativewindui/Text';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useState } from 'react';
import { Modal, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReportContent } from '../hooks/useReportContent';
import { type ReportReason, reportReasonLabels, reportReasons } from '../lib/reportReasons';

type ReportModalProps = {
  isVisible: boolean;
  onClose: () => void;
  messageId: string;
  userQuery: string;
  aiResponse: string;
  onSuccess: () => void;
};

export function ReportModal({
  isVisible,
  onClose,
  messageId,
  userQuery,
  aiResponse,
  onSuccess,
}: ReportModalProps) {
  const { colors } = useColorScheme();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const reportContentMutation = useReportContent();
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!selectedReason) return;

    reportContentMutation.mutate(
      {
        messageId,
        userQuery,
        aiResponse,
        reason: selectedReason,
        userComment: comment.trim() || null,
      },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      },
    );
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <KeyboardStickyView offset={{ opened: insets.bottom }} style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            activeOpacity={1}
            onPress={onClose}
            className="absolute bottom-0 left-0 right-0 top-0 bg-black/30"
          />
          <View className="rounded-t-xl bg-background p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold">Report</Text>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={20} color={colors.grey2} />
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4 max-h-60">
              {reportReasons.map((reason: ReportReason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  className={cn(
                    'mb-2 flex-row items-center rounded-md border border-border p-3',
                    selectedReason === reason && 'bg-primary/10 border-primary',
                  )}
                >
                  <View
                    className={cn(
                      'mr-3 h-5 w-5 items-center justify-center rounded-full border',
                      selectedReason === reason ? 'border-primary bg-primary' : 'border-muted',
                    )}
                  >
                    {selectedReason === reason && <Icon name="check" size={12} color="white" />}
                  </View>
                  <Text className={cn(selectedReason === reason && 'font-medium')}>
                    {reportReasonLabels[reason]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              className="mb-4 rounded-md border border-border bg-input p-3 text-foreground"
              placeholder="We value your feedback. Please provide any additional comments or context.(optional)"
              placeholderTextColor={colors.grey2}
              multiline
              numberOfLines={3}
              value={comment}
              onChangeText={setComment}
              style={{ textAlignVertical: 'top' }}
            />

            <View className="flex-row justify-end gap-2">
              <Button variant="tonal" onPress={onClose} disabled={reportContentMutation.isPending}>
                <Text>Cancel</Text>
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={!selectedReason || reportContentMutation.isPending}
              >
                <Text>{reportContentMutation.isPending ? 'Submitting...' : 'Submit'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </KeyboardStickyView>
    </Modal>
  );
}
