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

function AlertImpl({ ref, ...props }: AlertProps & { ref?: React.Ref<AlertMethods> }) {
  // `show()` presents the alert declared through this component's own props, which is how the
  // Android/default implementation behaves. It used to be a no-op stub, so the three tiles that
  // configure an <Alert title=... message=...> and call show() (PackCategoriesTile,
  // WeightAnalysisTile, PackStatsTile) did nothing at all on iOS.
  const propsRef = React.useRef(props);
  propsRef.current = props;

  React.useImperativeHandle(ref, () => {
    function present(args: AlertProps) {
      if (args.prompt) {
        promptWith({ ...args, prompt: args.prompt });
        return;
      }
      RNAlert.alert(
        args.title,
        args.message,
        args.buttons.map((b) => ({
          text: b.text,
          style: b.style,
          onPress: () => b.onPress?.(''),
        })),
      );
    }

    function promptWith(args: AlertProps & { prompt: NonNullable<AlertProps['prompt']> }) {
      RNAlert.prompt(
        args.title,
        args.message,
        args.buttons.map((b) => ({
          text: b.text,
          style: b.style,
          onPress: (value?: string) => b.onPress?.(value ?? ''),
        })),
        // RN core's prompt only offers plain-text/secure-text; 'login-password' (two fields) has
        // no UIAlertController equivalent it exposes, so it degrades to a single plain field.
        args.prompt.type === 'secure-text' ? 'secure-text' : 'plain-text',
        args.prompt.defaultValue,
        args.prompt.keyboardType,
      );
    }

    return {
      show: () => present(propsRef.current),
      alert: present,
      prompt: promptWith,
    };
  });

  return null;
}

const Alert = AlertImpl;

function AlertAnchor({ ref }: { ref: React.Ref<AlertMethods> }) {
  return <Alert ref={ref} title="" buttons={[]} />;
}

export { Alert, AlertAnchor };
export type { AlertButtonDef, AlertInputValue, AlertMethods, AlertProps };
