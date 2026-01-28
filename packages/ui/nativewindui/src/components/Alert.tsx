import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  type ViewProps,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react-native';

export interface AlertRef {
  alert: (title: string, message: string, buttons?: AlertButton[]) => void;
}

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export function Alert({ visible, title, message, buttons, onClose }: AlertProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={onClose}>
        <View className="w-4/5 rounded-lg bg-card p-6 shadow-lg">
          <View className="mb-4 flex-row items-start">
            <AlertTriangle size={24} className="mr-3 mt-0.5 text-amber-500" />
            <View className="flex-1">
              <Text className="text-base font-semibold">{title}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">{message}</Text>
            </View>
          </View>
          <View className="flex-row justify-end space-x-3">
            {buttons?.map((button, index) => (
              <Pressable
                key={index}
                className={cn(
                  'px-4 py-2',
                  button.style === 'destructive' && 'bg-destructive',
                  button.style === 'cancel' && 'bg-muted',
                  !button.style && 'bg-primary'
                )}
                onPress={() => {
                  button.onPress?.();
                  onClose();
                }}
              >
                <Text
                  className={cn(
                    'font-medium',
                    button.style === 'destructive' && 'text-destructive-foreground',
                    button.style === 'cancel' && 'text-foreground',
                    !button.style && 'text-primary-foreground'
                  )}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export function useAlert() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<{ title: string; message: string; buttons?: AlertButton[] }>({
    title: '',
    message: '',
  });

  const show = (title: string, message: string, buttons?: AlertButton[]) => {
    setConfig({ title, message, buttons });
    setVisible(true);
  };

  const AlertComponent = (
    <Alert
      visible={visible}
      title={config.title}
      message={config.message}
      buttons={config.buttons}
      onClose={() => setVisible(false)}
    />
  );

  return { show, AlertComponent };
}

export interface AlertAnchorProps extends ViewProps {
  children: React.ReactNode;
}

export function AlertAnchor({ children, ...props }: AlertAnchorProps) {
  return <View {...props}>{children}</View>;
}
