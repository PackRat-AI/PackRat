// Minimal type shim for react-native-purchases.
// Full types are provided by the installed package after `bun install`.
declare module 'react-native-purchases' {
  export enum LOG_LEVEL {
    VERBOSE = 'VERBOSE',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
  }

  export interface CustomerInfo {
    entitlements: {
      active: Record<string, EntitlementInfo>;
    };
  }

  export interface EntitlementInfo {
    identifier: string;
    isActive: boolean;
  }

  export interface LogInResult {
    customerInfo: CustomerInfo;
    created: boolean;
  }

  const Purchases: {
    setLogLevel(level: LOG_LEVEL): void;
    configure(options: { apiKey: string; useAmazon?: boolean }): void;
    getCustomerInfo(): Promise<CustomerInfo>;
    logIn(appUserID: string): Promise<LogInResult>;
    logOut(): Promise<CustomerInfo>;
  };

  export default Purchases;
}
