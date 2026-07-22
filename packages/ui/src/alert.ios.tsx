import {
  Alert as ExpoAlert,
  Host,
  Button as SwiftUIButton,
  Text as SwiftUIText,
} from '@expo/ui/swift-ui';
import { hidden } from '@expo/ui/swift-ui/modifiers';
import * as React from 'react';
import { Alert as RNAlert } from 'react-native';

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
  materialIcon?: unknown;
  materialWidth?: number;
  materialPortalHost?: string;
  children?: React.ReactNode;
};

type AlertMethods = {
  show: () => void;
  alert: (args: AlertProps) => void;
  prompt: (args: AlertProps & { prompt: NonNullable<AlertProps['prompt']> }) => void;
};

const ROLE_MAP: Record<AlertButtonStyle, 'default' | 'cancel' | 'destructive'> = {
  default: 'default',
  cancel: 'cancel',
  destructive: 'destructive',
};

function AlertImpl({
  ref,
  title: titleProp,
  message: messageProp,
  buttons: buttonsProp,
}: AlertProps & { ref?: React.Ref<AlertMethods> }) {
  const [isPresented, setIsPresented] = React.useState(false);
  const [{ title, message, buttons }, setState] = React.useState<{
    title: string;
    message: string | undefined;
    buttons: AlertButtonDef[];
  }>({ title: titleProp, message: messageProp, buttons: buttonsProp });

  React.useImperativeHandle(ref, () => ({
    show: () => setIsPresented(true),
    alert: (args) => {
      setState({ title: args.title, message: args.message, buttons: args.buttons });
      setIsPresented(true);
    },
    prompt: (args) => {
      // No @expo/ui equivalent for a text-input alert — RN's native Alert.prompt is iOS-only
      // and already a real native alert, so it's a legitimate fallback here (not a downgrade).
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

  return (
    <Host matchContents style={{ width: 0, height: 0 }}>
      <ExpoAlert title={title} isPresented={isPresented} onIsPresentedChange={setIsPresented}>
        {/* Invisible trigger — this Alert is always driven imperatively via the ref, never by
            a real tap on Trigger's content, but @expo/ui's Alert requires a Trigger child. */}
        <ExpoAlert.Trigger>
          <SwiftUIButton label="" modifiers={[hidden()]} />
        </ExpoAlert.Trigger>
        {message ? (
          <ExpoAlert.Message>
            <SwiftUIText>{message}</SwiftUIText>
          </ExpoAlert.Message>
        ) : null}
        <ExpoAlert.Actions>
          {buttons.map((button, index) => (
            <SwiftUIButton
              // biome-ignore lint/suspicious/noArrayIndexKey: buttons have no stable id in the old API either
              key={`${button.text}-${index}`}
              label={button.text}
              role={button.style ? ROLE_MAP[button.style] : 'default'}
              onPress={() => button.onPress?.('')}
            />
          ))}
        </ExpoAlert.Actions>
      </ExpoAlert>
    </Host>
  );
}

const Alert = AlertImpl;

function AlertAnchor({ ref }: { ref: React.Ref<AlertMethods> }) {
  return <Alert ref={ref} title="" buttons={[]} />;
}

export { Alert, AlertAnchor };
export type { AlertButtonDef, AlertInputValue, AlertMethods, AlertProps };
