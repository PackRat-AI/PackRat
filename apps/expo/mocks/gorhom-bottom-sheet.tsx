import * as React from 'react';
import { ScrollView, View } from 'react-native';

// Web stubs for @gorhom/bottom-sheet — sheets render inline as plain views.

export const BottomSheetModalProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const BottomSheetModal = React.forwardRef<
  unknown,
  { children?: React.ReactNode; [k: string]: unknown }
>(({ children }, _ref) => <View>{children}</View>);
BottomSheetModal.displayName = 'BottomSheetModal';

export const BottomSheetView = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: unknown;
}) => <View style={style as never}>{children}</View>;

export const BottomSheetScrollView = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: unknown;
}) => <ScrollView style={style as never}>{children}</ScrollView>;

export const BottomSheetFlatList = ({
  data,
  renderItem,
  keyExtractor,
  style,
}: {
  data?: unknown[];
  renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  style?: unknown;
}) => (
  <ScrollView style={style as never}>
    {(data ?? []).map((item, index) => (
      <View key={keyExtractor ? keyExtractor(item, index) : String(index)}>
        {renderItem?.({ item, index })}
      </View>
    ))}
  </ScrollView>
);

export const BottomSheetTextInput = (props: React.ComponentProps<'input'>) => <input {...props} />;

export function useBottomSheetModal() {
  return { dismiss: () => {}, dismissAll: () => {} };
}

export function useBottomSheet() {
  return {
    expand: () => {},
    collapse: () => {},
    close: () => {},
    snapToIndex: () => {},
    snapToPosition: () => {},
    forceClose: () => {},
  };
}
