import { useEffect } from 'react';
import { Keyboard } from 'react-native';

/**
 * Hook that automatically blurs a text input when the keyboard is hidden.
 * Useful for fixing keyboard behavior issues on Android.
 *
 * @param textInputRef - Ref to the TextInput or SearchInput component
 * @param options - Optional configuration
 * @param options.enabled - Whether the hook should be active (default: true)
 */
export function useKeyboardHideBlur(
  textInputRef: React.RefObject<{ blur?: () => void } | null>,
  options?: { enabled?: boolean },
) {
  const { enabled = true } = options ?? {};

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const keyboardDidHideCallback = () => {
      if (textInputRef.current?.blur) {
        textInputRef.current.blur();
      }
    };

    const keyboardDidHideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      keyboardDidHideCallback,
    );

    return () => {
      keyboardDidHideSubscription?.remove();
    };
  }, [textInputRef, enabled]);
}
