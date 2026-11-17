/**
 * Action sheet entry point. iOS and web keep `@expo/react-native-action-sheet` (a native
 * `UIAlertController` sheet on iOS); `action-sheet.android.tsx` swaps in an MD3 modal bottom sheet
 * behind the same `showActionSheetWithOptions(options, callback)` call.
 */
export { useActionSheet } from '@expo/react-native-action-sheet';

/** Android-only host; nothing to mount elsewhere. */
function ActionSheetHost() {
  return null;
}

export { ActionSheetHost };
