// Minimal type shim for react-native-purchases-ui.
// Full types are provided by the installed package after `bun install`.
declare module 'react-native-purchases-ui' {
  import type { ReactNode } from 'react';

  export enum PAYWALL_RESULT {
    NOT_PRESENTED = 'NOT_PRESENTED',
    ERROR = 'ERROR',
    CANCELLED = 'CANCELLED',
    PURCHASED = 'PURCHASED',
    RESTORED = 'RESTORED',
  }

  export interface PaywallProps {
    onPurchaseCompleted?: (event: {
      customerInfo: import('react-native-purchases').CustomerInfo;
    }) => void;
    onRestoreCompleted?: (event: {
      customerInfo: import('react-native-purchases').CustomerInfo;
    }) => void;
    onDismiss?: () => void;
    children?: ReactNode;
  }

  export interface PresentPaywallIfNeededOptions {
    requiredEntitlementIdentifier: string;
  }

  const RevenueCatUI: {
    Paywall: (props: PaywallProps) => ReactNode;
    presentPaywallIfNeeded(options: PresentPaywallIfNeededOptions): Promise<PAYWALL_RESULT>;
  };

  export default RevenueCatUI;
}
