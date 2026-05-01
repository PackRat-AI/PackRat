import * as SheetPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

export interface SheetRef {
  present: () => void;
  dismiss: () => void;
  close: () => void;
}

export interface SheetProps {
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
}

export const Sheet = React.forwardRef<SheetRef, SheetProps>(({ children, onDismiss }, ref) => {
  const [open, setOpen] = React.useState(false);
  const dismissingRef = React.useRef(false);

  // Prevent page freeze if component unmounts while sheet is open (focus trap cleanup)
  React.useEffect(() => () => setOpen(false), []);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next && !dismissingRef.current) {
        dismissingRef.current = true;
        setOpen(false);
        onDismiss?.();
        requestAnimationFrame(() => {
          dismissingRef.current = false;
        });
      } else if (next) {
        setOpen(true);
      }
    },
    [onDismiss],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      present: () => setOpen(true),
      dismiss: () => handleOpenChange(false),
      close: () => handleOpenChange(false),
    }),
    [handleOpenChange],
  );

  return (
    <SheetPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {/* forceMount on Portal keeps children mounted (prevents state loss on close) */}
      <SheetPrimitive.Portal forceMount>
        <SheetPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=closed]:hidden" />
        <SheetPrimitive.Content className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-auto rounded-t-lg bg-background p-6 shadow-lg data-[state=closed]:hidden focus:outline-none">
          {children}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
});
Sheet.displayName = 'Sheet';

export function useSheetRef() {
  return React.useRef<SheetRef>(null);
}
