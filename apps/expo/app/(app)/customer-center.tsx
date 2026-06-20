import { useQueryClient } from '@tanstack/react-query';
import { CUSTOMER_INFO_QUERY_KEY } from 'expo-app/features/purchases/hooks/useCustomerInfo';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function CustomerCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleDismiss = () => {
    queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <RevenueCatUI.CustomerCenterView
        style={{ flex: 1 }}
        shouldShowCloseButton={false}
        onDismiss={handleDismiss}
      />
    </View>
  );
}
