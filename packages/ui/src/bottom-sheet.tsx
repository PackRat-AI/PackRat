import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';

// Plain RN composition — Sheet never needed a Host bridge, it already wrapped
// @gorhom/bottom-sheet (an actively-maintained RN library, not @expo/ui). Ported directly.

function Sheet({
  index = 0,
  backgroundStyle,
  style,
  handleIndicatorStyle,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof BottomSheetModal> & {
  ref?: React.Ref<BottomSheetModal>;
}) {
  const { colors } = useColorScheme();

  const renderBackdrop = React.useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      backgroundStyle={backgroundStyle ?? { backgroundColor: colors.card }}
      style={
        style ?? {
          borderWidth: 1,
          borderColor: colors.grey5,
          borderTopStartRadius: 16,
          borderTopEndRadius: 16,
        }
      }
      handleIndicatorStyle={handleIndicatorStyle ?? { backgroundColor: colors.grey4 }}
      backdropComponent={renderBackdrop}
      {...props}
    />
  );
}

function useSheetRef() {
  return React.useRef<BottomSheetModal>(null);
}

export { Sheet, useSheetRef };
