import { assertPresent } from '@packrat/guards';
import { useKeyboardHideBlur } from 'expo-app/lib/hooks/useKeyboardHideBlur';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type * as React from 'react';
import { TextInput } from 'react-native';

/**
 * Enhanced SearchInput component that automatically handles keyboard hide blur fix.
 * Drop-in replacement for a TextInput with built-in Android keyboard behavior fix.
 */
export const SearchInput = forwardRef<
  React.ComponentRef<typeof TextInput>,
  React.ComponentPropsWithoutRef<typeof TextInput>
>((props, ref) => {
  const searchInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Apply keyboard hide blur fix
  useKeyboardHideBlur({ textInputRef: asNonNullableRef(searchInputRef) });

  // Forward ref methods to the internal ref
  useImperativeHandle(ref, () => {
    assertPresent(searchInputRef.current);
    return searchInputRef.current;
  }, []);

  return <TextInput ref={searchInputRef} {...props} />;
});

SearchInput.displayName = 'SearchInput';
