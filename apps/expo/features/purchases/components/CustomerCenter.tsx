import { Button, Text } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export async function presentCustomerCenter() {
  Sentry.addBreadcrumb({
    category: 'purchases',
    message: 'Presenting customer center',
    level: 'info',
  });
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'presentCustomerCenter' },
    });
    throw error;
  }
}

/** Button that opens the RevenueCat Customer Center. */
export function CustomerCenterButton({ label = 'Manage Subscription' }: { label?: string }) {
  return (
    <Button variant="secondary" onPress={presentCustomerCenter}>
      <Text>{label}</Text>
    </Button>
  );
}
