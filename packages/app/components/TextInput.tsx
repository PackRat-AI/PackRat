import { assertPresent } from '@packrat/guards';
import { useKeyboardHideBlur } from 'app/lib/hooks/useKeyboardHideBlur';
import { asNonNullableRef } from 'app/lib/utils/asNonNullableRef';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

/**
 * Enhanced TextInput component that automatically handles keyboard hide blur fix.
 * Drop-in replacement for React Native's TextInput with built-in Android keyboard behavior fix.
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const textInputRef = useRef<RNTextInput>(null);

  // Apply keyboard hide blur fix
  useKeyboardHideBlur(asNonNullableRef(textInputRef));

  // Forward ref methods to the internal ref
  useImperativeHandle(ref, () => {
    assertPresent(textInputRef.current);
    return textInputRef.current;
  }, []);

  return <RNTextInput ref={textInputRef} {...props} />;
});

TextInput.displayName = 'TextInput';
