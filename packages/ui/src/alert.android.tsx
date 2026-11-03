import {
  AlertDialog as JCAlertDialog,
  Row as JCRow,
  Text as JCText,
  TextButton as JCTextButton,
} from '@expo/ui/jetpack-compose';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import type { AlertButtonDef, AlertMethods, AlertProps } from './alert.rn';
import { Alert as RNAlertFallback } from './alert.rn';
import { ThemedHost as JCHost } from './themed-host';

/**
 * Material 3 `AlertDialog` for Android, replacing the `@rn-primitives/alert-dialog` composition.
 *
 * Verified on-device (TECNO KL4, 2026-08-06, via `/admin/ai-packs` → "Generate Packs"): real M3
 * dialog (correct scrim, surface, typography), `Title`/`Text` slots emit real accessibility nodes,
 * both button slots fire their callbacks, and `onDismissRequest` fires on the hardware back button
 * and is consumed by the dialog rather than the navigator. Material orders the slots itself —
 * confirm right, cancel left — regardless of array order.
 *
 * This is the container shape that works — unlike `Card` it has **named slots**, and unlike
 * `ListItem` the dialog is not inside a scroller, so the `Host` never competes for a drag gesture.
 *
 * Two `@expo/ui` API traps this file has to respect:
 * - `Button`'s handler is `onClick`, **not** `onPress`. `onPress` type-checks and silently no-ops.
 * - `Button`'s label must be a Compose `<Text>` child, not a bare string. A bare string renders an
 *   unlabelled (but still tappable) pill with no accessibility node.
 *
 * Actions are MD3 dialog actions: `TextButton`s, with a destructive action in the error colour.
 * The confirm slot holds a `Row`, so an alert with more than two buttons renders every non-cancel
 * action there, after the dismiss action, as Material lays out stacked dialog actions.
 *
 * **One delegation.** `AlertDialog` has no text-input slot, so a `prompt()` (one call site
 * app-wide — the typed delete-account confirmation) falls back to the RN implementation.
 */
function Alert({ ref, children, ...props }: AlertProps & { ref?: React.Ref<AlertMethods> }) {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<AlertProps>(props);
  const fallbackRef = React.useRef<AlertMethods>(null);
  const { colors } = useColorScheme();

  // A prompt needs a text field, which AlertDialog has no slot for.
  const needsFallback = (args: AlertProps) => !!args.prompt;

  // useImperativeHandle rather than @rn-primitives' useAugmentedRef: that helper augments a real RN
  // node's ref, and this component's root is a Compose Host with no RN node to attach to.
  React.useImperativeHandle(
    ref,
    () => ({
      show: () => {
        if (needsFallback(current)) {
          fallbackRef.current?.show();
          return;
        }
        setOpen(true);
      },
      alert: (args: AlertProps) => {
        if (needsFallback(args)) {
          fallbackRef.current?.alert(args);
          return;
        }
        setCurrent(args);
        setOpen(true);
      },
      prompt: (args: AlertProps & { prompt: NonNullable<AlertProps['prompt']> }) => {
        // Always RN: there is no text-input slot on AlertDialog.
        fallbackRef.current?.prompt(args);
      },
    }),
    [current],
  );

  // `cancel` is the dismiss affordance; every other button is a confirm action. Material orders
  // the slots itself, so the visual order comes from the platform rather than from array order.
  const cancelButton = current.buttons.find((b) => b.style === 'cancel');
  const confirmButtons = current.buttons.filter((b) => b.style !== 'cancel');

  function close() {
    setOpen(false);
  }

  function renderAction({
    button,
    fallbackText,
  }: {
    button: AlertButtonDef;
    fallbackText: string;
  }) {
    return (
      <JCTextButton
        key={button.text ?? fallbackText}
        colors={button.style === 'destructive' ? { contentColor: colors.destructive } : undefined}
        onClick={() => {
          close();
          button.onPress?.('');
        }}
      >
        <JCText>{button.text ?? fallbackText}</JCText>
      </JCTextButton>
    );
  }

  return (
    <>
      {/* Rendered but inert unless a prompt routes to it. */}
      <RNAlertFallback ref={fallbackRef} {...props}>
        {children}
      </RNAlertFallback>

      {open && (
        <JCHost matchContents>
          <JCAlertDialog
            onDismissRequest={() => {
              close();
              // Back button / scrim tap is a cancellation, matching the RN version's onOpenChange.
              cancelButton?.onPress?.('');
            }}
          >
            <JCAlertDialog.Title>
              <JCText style={{ typography: 'headlineSmall' }}>{current.title}</JCText>
            </JCAlertDialog.Title>
            {!!current.message && (
              <JCAlertDialog.Text>
                <JCText style={{ typography: 'bodyMedium' }}>{current.message}</JCText>
              </JCAlertDialog.Text>
            )}
            {confirmButtons.length > 0 && (
              <JCAlertDialog.ConfirmButton>
                <JCRow>
                  {confirmButtons.map((button) => renderAction({ button, fallbackText: 'OK' }))}
                </JCRow>
              </JCAlertDialog.ConfirmButton>
            )}
            {!!cancelButton && (
              <JCAlertDialog.DismissButton>
                {renderAction({ button: cancelButton, fallbackText: 'Cancel' })}
              </JCAlertDialog.DismissButton>
            )}
          </JCAlertDialog>
        </JCHost>
      )}
    </>
  );
}

function AlertAnchor({ ref }: { ref: React.Ref<AlertMethods> }) {
  return <Alert ref={ref} title="" buttons={[]} />;
}

export { Alert, AlertAnchor };
export type { AlertButtonDef, AlertInputValue, AlertMethods, AlertProps } from './alert.rn';
