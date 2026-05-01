import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@packrat/web-ui/components/alert-dialog';
import type { ReactNode } from 'react';
import { forwardRef, useImperativeHandle, useState } from 'react';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertArgs = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

export type AlertMethods = {
  alert: (args: AlertArgs) => void;
};

export type AlertProps = {
  ref?: React.Ref<AlertMethods>;
  title: string;
  buttons?: AlertButton[];
  children?: ReactNode;
};

export const Alert = forwardRef<AlertMethods, AlertProps>(({ children }, ref) => {
  const [pending, setPending] = useState<AlertArgs | null>(null);

  useImperativeHandle(ref, () => ({
    alert: (args) => setPending(args),
  }));

  const dismiss = () => setPending(null);

  const buttons = pending?.buttons ?? [{ text: 'OK' }];
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionBtns = buttons.filter((b) => b.style !== 'cancel');

  return (
    <>
      {children}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && dismiss()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.message && <AlertDialogDescription>{pending.message}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {cancelBtn && (
              <AlertDialogCancel
                onClick={() => {
                  cancelBtn.onPress?.();
                  dismiss();
                }}
              >
                {cancelBtn.text}
              </AlertDialogCancel>
            )}
            {actionBtns.map((btn) => (
              <AlertDialogAction
                key={btn.text}
                onClick={() => {
                  btn.onPress?.();
                  dismiss();
                }}
              >
                {btn.text}
              </AlertDialogAction>
            ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
Alert.displayName = 'Alert';

export const AlertAnchor = forwardRef<AlertMethods>((_, ref) => (
  <Alert ref={ref} title="" buttons={[]} />
));
AlertAnchor.displayName = 'AlertAnchor';
