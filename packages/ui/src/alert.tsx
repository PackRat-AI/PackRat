import * as AlertDialogPrimitive from '@rn-primitives/alert-dialog';
import { useAugmentedRef } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import type { MaterialIconName } from 'expo-app/components/Icon/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { type KeyboardTypeOptions, type TextInput, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Button } from './button';
import { Text } from './text';
import { TextField } from './text-field';

// Plain RN composition — Alert never needed a Host bridge on this platform either. The old
// package's Android/default Alert was already built on @rn-primitives/alert-dialog (an
// unstyled RN primitive), not @expo/ui. iOS uses RN core's native Alert.alert/Alert.prompt
// instead (see alert.ios.tsx) — this file is the Android/default (Material-style) design.

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
  children?: React.ReactNode;
  prompt?: {
    type?: 'plain-text' | 'secure-text' | 'login-password';
    defaultValue?: string;
    keyboardType?: KeyboardTypeOptions;
  };
  materialIcon?: { name: MaterialIconName; color?: string };
  materialWidth?: number;
  materialPortalHost?: string;
};

type AlertMethods = {
  show: () => void;
  alert: (args: AlertProps) => void;
  prompt: (args: AlertProps & { prompt: NonNullable<AlertProps['prompt']> }) => void;
};

function Alert({
  ref,
  children,
  title: titleProp,
  message: messageProp,
  buttons: buttonsProp,
  prompt: promptProp,
  materialIcon: materialIconProp,
  materialWidth: materialWidthProp,
  materialPortalHost,
}: AlertProps & { ref?: React.Ref<AlertMethods> }) {
  const { height } = useReanimatedKeyboardAnimation();
  const [open, setOpen] = React.useState(false);
  const [{ title, message, buttons, prompt, materialIcon, materialWidth }, setProps] =
    React.useState<AlertProps>({
      title: titleProp,
      message: messageProp,
      buttons: buttonsProp,
      prompt: promptProp,
      materialIcon: materialIconProp,
      materialWidth: materialWidthProp,
    });
  const [text, setText] = React.useState(promptProp?.defaultValue ?? '');
  const [password, setPassword] = React.useState('');
  const { colors } = useColorScheme();
  const passwordRef = React.useRef<TextInput>(null);
  const augmentedRef = useAugmentedRef({
    ref: ref as React.Ref<AlertMethods>,
    methods: {
      show: () => setOpen(true),
      alert,
      prompt: promptAlert,
    },
  });

  const bottomPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: height.value * -1,
  }));

  function promptAlert(args: AlertProps & { prompt: Required<AlertProps['prompt']> }) {
    setText(args.prompt?.defaultValue ?? '');
    setPassword('');
    setProps(args);
    setOpen(true);
  }

  function alert(args: AlertProps) {
    setText(args.prompt?.defaultValue ?? '');
    setPassword('');
    setProps(args);
    setOpen(true);
  }

  function onOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setText(prompt?.defaultValue ?? '');
      setPassword('');
    }
    setOpen(nextOpen);
  }

  function resolveValue() {
    return prompt?.type === 'login-password' ? { login: text, password } : text;
  }

  return (
    <AlertDialogPrimitive.Root
      // @rn-primitives/hooks' useAugmentedRef merges imperative `methods` onto the forwarded
      // View ref at runtime (documented pattern), but its return type is RefObject<T|null> for
      // the *methods* type param, not the underlying View — Root's `ref` prop wants Ref<View>.
      ref={augmentedRef as unknown as React.Ref<View>}
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogPrimitive.Trigger asChild={!!children}>{children}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal hostName={materialPortalHost}>
        <AlertDialogPrimitive.Overlay asChild>
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={bottomPaddingStyle}
            className="bg-popover/80 absolute bottom-0 left-0 right-0 top-0 items-center justify-center px-3"
          >
            <AlertDialogPrimitive.Content>
              <Animated.View
                style={typeof materialWidth === 'number' ? { width: materialWidth } : undefined}
                entering={FadeInDown}
                exiting={FadeOutDown}
                className="bg-card min-w-72 max-w-xl rounded-3xl p-6 pt-7 shadow-xl"
              >
                {!!materialIcon && (
                  <View className="items-center pb-4">
                    <Icon
                      name={materialIcon.name}
                      color={materialIcon.color ?? colors.foreground}
                      size={27}
                    />
                  </View>
                )}
                {message ? (
                  <>
                    <AlertDialogPrimitive.Title asChild>
                      <Text
                        variant="title2"
                        className={cn(!!materialIcon && 'text-center', 'pb-4')}
                      >
                        {title}
                      </Text>
                    </AlertDialogPrimitive.Title>
                    <AlertDialogPrimitive.Description asChild>
                      <Text variant="subhead" className="pb-4 opacity-90">
                        {message}
                      </Text>
                    </AlertDialogPrimitive.Description>
                  </>
                ) : materialIcon ? (
                  <AlertDialogPrimitive.Title asChild>
                    <Text variant="title2" className={cn(!!materialIcon && 'text-center', 'pb-4')}>
                      {title}
                    </Text>
                  </AlertDialogPrimitive.Title>
                ) : (
                  <AlertDialogPrimitive.Title asChild>
                    <Text variant="subhead" className="pb-4 opacity-90">
                      {title}
                    </Text>
                  </AlertDialogPrimitive.Title>
                )}
                {prompt ? (
                  <View className="gap-4 pb-8">
                    <TextField
                      autoFocus
                      labelClassName="bg-card"
                      keyboardType={prompt.type === 'secure-text' ? 'default' : prompt.keyboardType}
                      label={prompt.type === 'login-password' ? 'Email' : ''}
                      secureTextEntry={prompt.type === 'secure-text'}
                      value={text}
                      onChangeText={setText}
                      onSubmitEditing={() => {
                        if (prompt.type === 'login-password' && passwordRef.current) {
                          passwordRef.current.focus();
                          return;
                        }
                        for (const button of buttons) {
                          if (!button.style || button.style === 'default') {
                            button.onPress?.(resolveValue());
                          }
                        }
                        onOpenChange(false);
                      }}
                      blurOnSubmit={prompt.type !== 'login-password'}
                    />
                    {prompt.type === 'login-password' && (
                      <TextField
                        ref={passwordRef}
                        labelClassName="bg-card"
                        keyboardType={prompt.keyboardType}
                        defaultValue={prompt.defaultValue}
                        label="Password"
                        secureTextEntry={prompt.type === 'login-password'}
                        value={password}
                        onChangeText={setPassword}
                        onSubmitEditing={() => {
                          for (const button of buttons) {
                            if (!button.style || button.style === 'default') {
                              button.onPress?.(resolveValue());
                            }
                          }
                          onOpenChange(false);
                        }}
                      />
                    )}
                  </View>
                ) : (
                  <View className="h-0.5" />
                )}
                <View
                  className={cn(
                    'flex-row items-center justify-end gap-0.5',
                    buttons.length > 2 && 'justify-between',
                  )}
                >
                  {buttons.map((button, index) => {
                    const key = `${button.text}-${index}`;
                    const wrapperClassName = cn(
                      buttons.length > 2 && index === 0 && 'flex-1 items-start',
                    );
                    if (button.style === 'cancel') {
                      return (
                        <View key={key} className={wrapperClassName}>
                          <AlertDialogPrimitive.Cancel asChild>
                            <Button
                              testID={button.testID}
                              variant="plain"
                              onPress={() => button.onPress?.(resolveValue())}
                            >
                              <Text className="text-primary text-[14px] font-medium">
                                {button.text}
                              </Text>
                            </Button>
                          </AlertDialogPrimitive.Cancel>
                        </View>
                      );
                    }
                    if (button.style === 'destructive') {
                      return (
                        <View key={key} className={wrapperClassName}>
                          <AlertDialogPrimitive.Action asChild>
                            <Button
                              testID={button.testID}
                              variant="tonal"
                              className="bg-destructive/10 dark:bg-destructive/25"
                              onPress={() => button.onPress?.(resolveValue())}
                            >
                              <Text className="text-foreground text-[14px] font-medium">
                                {button.text}
                              </Text>
                            </Button>
                          </AlertDialogPrimitive.Action>
                        </View>
                      );
                    }
                    return (
                      <View key={key} className={wrapperClassName}>
                        <AlertDialogPrimitive.Action asChild>
                          <Button
                            testID={button.testID}
                            variant="plain"
                            onPress={() => button.onPress?.(resolveValue())}
                          >
                            <Text className="text-primary text-[14px] font-medium">
                              {button.text}
                            </Text>
                          </Button>
                        </AlertDialogPrimitive.Action>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            </AlertDialogPrimitive.Content>
          </Animated.View>
        </AlertDialogPrimitive.Overlay>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

function AlertAnchor({ ref }: { ref: React.Ref<AlertMethods> }) {
  return <Alert ref={ref} title="" buttons={[]} />;
}

export { Alert, AlertAnchor };
export type { AlertButtonDef, AlertInputValue, AlertMethods, AlertProps };
