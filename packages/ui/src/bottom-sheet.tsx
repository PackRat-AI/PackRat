import {
  BottomSheetModal,
  BottomSheetView as ExpoBottomSheetView,
} from '@expo/ui/community/bottom-sheet';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import * as React from 'react';

/**
 * `@expo/ui`'s sheet types are hand-written rather than extending RN's `ViewProps`, so NativeWind's
 * global `className`→`style` augmentation never reaches them. These `cssInterop` calls make
 * `className` work at runtime, and the widened types below tell TS the same — the pattern already
 * used for `Host` in toggle.{ios,android}.tsx.
 */
cssInterop(ExpoBottomSheetView, { className: 'style' });

type SheetViewProps = React.ComponentProps<typeof ExpoBottomSheetView> & { className?: string };

/** Content wrapper for a `Sheet`. A pass-through view — the parent `Sheet` owns sizing. */
const SheetView = ExpoBottomSheetView as (props: SheetViewProps) => React.ReactElement;

type SheetProps = React.ComponentPropsWithoutRef<typeof BottomSheetModal> & {
  ref?: React.Ref<React.ComponentRef<typeof BottomSheetModal>>;
};

/**
 * Native bottom sheet — a real SwiftUI sheet on iOS and a Material 3 `ModalBottomSheet` on
 * Android, via `@expo/ui`'s API-compatible replacement for `@gorhom/bottom-sheet`.
 *
 * `present()`, `dismiss()` and `onDismiss` keep the same contract as `@gorhom`'s
 * `BottomSheetModal`, so call sites and `useSheetRef` need no changes.
 *
 * Three things the old wrapper passed are deliberately gone, because the native sheet owns them and
 * supplying them had no effect: the custom `BottomSheetBackdrop`, `handleIndicatorStyle`, and the
 * `style` border/radius. Safe-area insets go the same way — there are no `topInset`/`bottomInset`
 * props here because the platform sheet already insets its own content.
 *
 * `backgroundStyle` is kept: Android maps it to the sheet background (iOS uses the system one).
 *
 * `enablePanDownToClose` defaults to **true** here, unlike `@expo/ui`'s own `false`. The old wrapper
 * passed a `BottomSheetBackdrop` to every sheet unconditionally, and that component's default
 * `pressBehavior` is `'close'` — so every sheet in this app has always been dismissable by tapping
 * outside it. `@expo/ui` folds that behaviour into this one prop (on Android it also gates the
 * hardware back button and scrim tap), so leaving it at the library default silently traps the user
 * in any sheet whose call site doesn't pass it and has no close button. Defaulting it on preserves
 * the pre-migration contract; a call site that genuinely wants a non-dismissable sheet still opts
 * out by passing `false` explicitly, because `...props` is spread after this.
 */
function Sheet({
  index = 0,
  backgroundStyle,
  enablePanDownToClose = true,
  ref,
  ...props
}: SheetProps) {
  const { colors } = useColorScheme();

  return (
    <BottomSheetModal
      ref={ref}
      index={index}
      backgroundStyle={backgroundStyle ?? { backgroundColor: colors.card }}
      enablePanDownToClose={enablePanDownToClose}
      {...props}
    />
  );
}

function useSheetRef() {
  return React.useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
}

export { Sheet, SheetView, useSheetRef };
export type { SheetProps, SheetViewProps };
