import * as React from 'react';

export const BottomSheetView = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

export const BottomSheetScrollView = ({ children }: { children?: React.ReactNode }) => (
  <div style={{ overflow: 'auto' }}>{children}</div>
);

export const BottomSheetFlatList = () => null;
export const BottomSheetTextInput = () => null;
export const BottomSheetSectionList = () => null;
export const BottomSheetBackdrop = () => null;
export const BottomSheetHandle = () => null;
export const BottomSheetFooter = () => null;

export class BottomSheetModal extends React.Component {
  present() {}
  dismiss() {}
  close() {}
  snapToIndex() {}
  snapToPosition() {}
  expand() {}
  collapse() {}
  forceClose() {}
}

export class BottomSheet extends React.Component {
  snapToIndex() {}
  snapToPosition() {}
  expand() {}
  collapse() {}
  close() {}
  forceClose() {}
}

export const BottomSheetModalProvider = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

export const useBottomSheet = () => ({
  snapToIndex: () => {},
  snapToPosition: () => {},
  expand: () => {},
  collapse: () => {},
  close: () => {},
  forceClose: () => {},
});
