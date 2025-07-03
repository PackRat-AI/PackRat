import { Text } from "@packrat/ui/nativewindui/Text";
import { Icon } from "@roninoss/icons";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { ReportModal } from "./ReportModal";

type ReportButtonProps = {
  messageId: string;
  aiResponse: string;
  userQuery: string;
};

export function ReportButton({
  messageId,
  aiResponse,
  userQuery,
}: ReportButtonProps) {
  const { colors } = useColorScheme();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reported, setReported] = useState(false);

  const handleReportSuccess = () => {
    setReported(true);
  };

  if (reported) {
    return (
      <View className="flex-row items-center">
        <Icon name="check-circle" size={14} color={colors.green} />
        <Text className="text-success ml-1 text-xs">Reported</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsModalVisible(true)}
        className="flex-row items-center opacity-70"
      >
        <Icon name="flag" size={14} color={colors.grey2} />
        <Text className="ml-1 text-xs text-muted-foreground">Report</Text>
      </TouchableOpacity>

      <ReportModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        messageId={messageId}
        userQuery={userQuery}
        aiResponse={aiResponse}
        onSuccess={handleReportSuccess}
      />
    </>
  );
}
