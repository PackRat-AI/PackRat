import {
  AlertDialog as JCAlertDialog,
  Button as JCButton,
  Host as JCHost,
  Text as JCText,
} from '@expo/ui/jetpack-compose';
import * as React from 'react';
import type { AlertMethods, AlertProps } from './alert.rn';
import { Alert as RNAlertFallback } from './alert.rn';

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
 * **Delegation, not full replacement.** `AlertDialog` exposes exactly two button slots and no
 * text-input slot, so two shapes fall back to the RN implementation rather than being approximated:
 * a `prompt()` (one call site app-wide — the typed delete-account confirmation) and any alert with
 * more than two buttons. Those are genuinely different dialogs, and rendering them wrong would be
 * worse than rendering them in RN.
 */
function Alert({ ref, children, ...props }: AlertProps & { ref?: React.Ref<AlertMethods> }) {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<AlertProps>(props);
  const fallbackRef = React.useRef<AlertMethods>(null);

  // A prompt needs a text field and >2 buttons need a third slot; neither exists on AlertDialog.
  const needsFallback = (args: AlertProps) => !!args.prompt || args.buttons.length > 2;

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

  // `cancel` is the dismiss affordance; the remaining button is the confirm action. Material orders
  // the slots itself, so the visual order comes from the platform rather than from array order.
  const cancelButton = current.buttons.find((b) => b.style === 'cancel');
  const confirmButton = current.buttons.find((b) => b.style !== 'cancel');

  function close() {
    setOpen(false);
  }

  return (
    <>
      {/* Rendered but inert unless a prompt / >2-button alert routes to it. */}
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
              <JCText>{current.title}</JCText>
            </JCAlertDialog.Title>
            {!!current.message && (
              <JCAlertDialog.Text>
                <JCText>{current.message}</JCText>
              </JCAlertDialog.Text>
            )}
            {!!confirmButton && (
              <JCAlertDialog.ConfirmButton>
                <JCButton
                  onClick={() => {
                    close();
                    confirmButton.onPress?.('');
                  }}
                >
                  <JCText>{confirmButton.text ?? 'OK'}</JCText>
                </JCButton>
              </JCAlertDialog.ConfirmButton>
            )}
            {!!cancelButton && (
              <JCAlertDialog.DismissButton>
                <JCButton
                  onClick={() => {
                    close();
                    cancelButton.onPress?.('');
                  }}
                >
                  <JCText>{cancelButton.text ?? 'Cancel'}</JCText>
                </JCButton>
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
