import { useQueryClient } from '@tanstack/react-query';
import { CUSTOMER_INFO_QUERY_KEY } from 'expo-app/features/purchases/hooks/useCustomerInfo';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export default function PaywallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleDismiss = () => {
    router.back();
  };

  const handlePurchaseCompleted = () => {
    queryClient.invalidateQueries({ queryKey: CUSTOMER_INFO_QUERY_KEY });
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <RevenueCatUI.Paywall
        style={{ flex: 1 }}
        onDismiss={handleDismiss}
        onPurchaseCompleted={handlePurchaseCompleted}
        onRestoreCompleted={handlePurchaseCompleted}
      />
    </View>
  );
}
