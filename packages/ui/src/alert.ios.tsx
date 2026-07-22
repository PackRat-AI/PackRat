import * as React from 'react';
import { Alert as RNAlert } from 'react-native';

// RN core's Alert.alert/Alert.prompt already renders a real native UIAlertController on iOS —
// no @expo/ui bridge needed, and it sidesteps the unverified ExpoAlert.Trigger invisible-button
// mechanism a SwiftUI-backed version would require. Same native look, zero Host risk.

type AlertInputValue = { login: string; password: string } | string;

type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

type AlertButtonDef = {
  text?: string;
  style?: AlertButtonStyle;
  onPress?: (text: AlertInputValue) => void;
  testID?: string;
};

type AlertProps = {
  title: string;
  buttons: AlertButtonDef[];
  message?: string;
  prompt?: {
    type?: 'plain-text' | 'secure-text' | 'login-password';
    defaultValue?: string;
    keyboardType?: string;
  };
  materialIcon?: { name: string; color?: string };
  materialWidth?: number;
  materialPortalHost?: string;
  children?: React.ReactNode;
};

type AlertMethods = {
  show: () => void;
  alert: (args: AlertProps) => void;
  prompt: (args: AlertProps & { prompt: NonNullable<AlertProps['prompt']> }) => void;
};

function AlertImpl({ ref }: AlertProps & { ref?: React.Ref<AlertMethods> }) {
  React.useImperativeHandle(ref, () => ({
    show: () => {},
    alert: (args) => {
      RNAlert.alert(
        args.title,
        args.message,
        args.buttons.map((b) => ({
          text: b.text,
          style: b.style,
          onPress: () => b.onPress?.(''),
        })),
      );
    },
    prompt: (args) => {
      RNAlert.prompt(
        args.title,
        args.message,
        args.buttons.map((b) => ({
          text: b.text,
          style: b.style,
          onPress: (value) => b.onPress?.(value ?? ''),
        })),
        args.prompt.type === 'secure-text' ? 'secure-text' : 'plain-text',
        args.prompt.defaultValue,
      );
    },
  }));

  return null;
}

const Alert = AlertImpl;

function AlertAnchor({ ref }: { ref: React.Ref<AlertMethods> }) {
  return <Alert ref={ref} title="" buttons={[]} />;
}

export { Alert, AlertAnchor };
export type { AlertButtonDef, AlertInputValue, AlertMethods, AlertProps };
