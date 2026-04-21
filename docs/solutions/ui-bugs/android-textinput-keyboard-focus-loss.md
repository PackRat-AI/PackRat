---
title: "Android TextInput Focus Persists After Keyboard Dismissal"
category: ui-bugs
date: 2026-04-21
tags:
  - android
  - keyboard
  - textinput
  - focus
  - nativewindui
  - react-native
  - user-experience
affected_components:
  - React Native TextInput
  - NativeWindUI SearchInput
platforms:
  - Android
severity: medium
problem_type: platform-specific-behavior
symptoms:
  - TextInput retains focus after keyboard dismissal
  - Keyboard fails to reappear on subsequent focus attempts
  - Inconsistent keyboard behavior flow
impact:
  - Degraded user input experience
  - Potential user confusion about input state
  - Platform inconsistency (Android vs iOS behavior)
reproducibility: consistent
environment:
  - React Native 0.81
  - Expo 54
  - NativeWindUI
  - Android platform
---

# Android TextInput Focus Persists After Keyboard Dismissal

## Problem Description

On Android, TextInput and SearchInput components retain focus after the keyboard is dismissed through system gestures (back button, tapping outside, or swipe gestures). This creates a broken user experience where:

1. The text input appears visually focused but the keyboard is hidden
2. Subsequent taps on the input fail to bring the keyboard back
3. Users must tap elsewhere to blur the input, then tap again to refocus and show the keyboard

This behavior is inconsistent with iOS, which automatically manages focus when the keyboard is dismissed.

## Root Cause Analysis

**Root Cause**: React Native's Android implementation doesn't automatically blur TextInput components when the keyboard is dismissed via system interactions, unlike iOS which handles this automatically.

The issue occurs because:
- Android's keyboard dismissal events don't automatically trigger React Native's blur behavior
- TextInput components maintain their focused state even when the keyboard is no longer visible
- The disconnect between keyboard visibility and focus state causes subsequent interaction failures

## Solution

### Core Implementation: useKeyboardHideBlur Hook

Created a custom hook that listens for keyboard dismissal and automatically blurs text inputs:

```tsx
// apps/expo/lib/hooks/useKeyboardHideBlur.tsx
import { useEffect } from 'react';
import { Keyboard } from 'react-native';

/**
 * Hook that automatically blurs a text input when the keyboard is hidden.
 * Useful for fixing keyboard behavior issues on Android.
 *
 * @param textInputRef - Ref to the TextInput or SearchInput component
 */
export function useKeyboardHideBlur(textInputRef: React.RefObject<any>) {
  useEffect(() => {
    const keyboardDidHideCallback = () => {
      textInputRef.current?.blur();
    };

    const keyboardDidHideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      keyboardDidHideCallback,
    );

    return () => {
      keyboardDidHideSubscription?.remove();
    };
  }, [textInputRef]);
}
```

### Enhanced Components

#### Enhanced TextInput Component

```tsx
// apps/expo/components/TextInput.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';
import { useKeyboardHideBlur } from 'expo-app/lib/hooks/useKeyboardHideBlur';

/**
 * Enhanced TextInput component that automatically handles keyboard hide blur fix.
 * Drop-in replacement for React Native's TextInput with built-in Android keyboard behavior fix.
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const textInputRef = useRef<RNTextInput>(null);
  
  // Apply keyboard hide blur fix
  useKeyboardHideBlur(textInputRef);
  
  // Forward ref methods to the internal ref
  useImperativeHandle(ref, () => textInputRef.current!);
  
  return <RNTextInput ref={textInputRef} {...props} />;
});

TextInput.displayName = 'TextInput';
```

#### Enhanced SearchInput Component

```tsx
// apps/expo/components/SearchInput.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { SearchInput as NativeWindUISearchInput } from '@packrat/ui/nativewindui';
import { useKeyboardHideBlur } from 'expo-app/lib/hooks/useKeyboardHideBlur';

/**
 * Enhanced SearchInput component that automatically handles keyboard hide blur fix.
 * Drop-in replacement for NativeWindUI's SearchInput with built-in Android keyboard behavior fix.
 */
export const SearchInput = forwardRef<any, React.ComponentProps<typeof NativeWindUISearchInput>>((props, ref) => {
  const searchInputRef = useRef<any>(null);
  
  // Apply keyboard hide blur fix
  useKeyboardHideBlur(searchInputRef);
  
  // Forward ref methods to the internal ref
  useImperativeHandle(ref, () => searchInputRef.current);
  
  return <NativeWindUISearchInput ref={searchInputRef} {...props} />;
});

SearchInput.displayName = 'SearchInput';
```

### Usage Examples

#### Drop-in Component Replacement

```tsx
// Before
import { TextInput } from 'react-native';

// After
import { TextInput } from 'expo-app/components/TextInput';

// No other changes needed - same API
<TextInput
  placeholder="Enter text..."
  value={value}
  onChangeText={setValue}
/>
```

#### Direct Hook Usage for Complex Components

```tsx
// apps/expo/app/auth/one-time-password.tsx
function OTPField({ /* props */ }) {
  const inputRef = React.useRef<TextInput>(null);
  
  // Apply keyboard hide blur fix
  useKeyboardHideBlur(inputRef);
  
  return (
    <TextField
      ref={inputRef}
      value={value}
      // ... other props
    />
  );
}
```

## Implementation Details

### Systematic Application

The solution was applied systematically across the codebase:

1. **Enhanced Components**: Created drop-in replacements for common input components
   - `apps/expo/components/TextInput.tsx`
   - `apps/expo/components/SearchInput.tsx`

2. **Import Updates**: Updated all TextInput/SearchInput imports throughout the app:
   - Authentication screens
   - Chat interfaces  
   - Search functionality
   - Form components
   - Content creation screens

3. **Direct Hook Usage**: Applied directly in complex components that couldn't use enhanced wrappers:
   - OTP input fields (`apps/expo/app/auth/one-time-password.tsx`)
   - Custom form implementations

### Files Modified

**New Files Created:**
- `apps/expo/lib/hooks/useKeyboardHideBlur.tsx` - Core hook implementation
- `apps/expo/components/TextInput.tsx` - Enhanced TextInput component
- `apps/expo/components/SearchInput.tsx` - Enhanced SearchInput component

**Files Updated:**
- `apps/expo/app/(app)/ai-chat.tsx`
- `apps/expo/app/(app)/messages/chat.tsx` 
- `apps/expo/app/(app)/messages/chat.android.tsx`
- `apps/expo/app/(app)/textinputdebug.tsx`
- `apps/expo/app/auth/one-time-password.tsx`
- `apps/expo/features/weather/screens/LocationsScreen.tsx`
- `apps/expo/features/weather/screens/LocationSearchScreen.tsx`
- `apps/expo/features/feed/screens/PostDetailScreen.tsx`
- `apps/expo/features/feed/screens/CreatePostScreen.tsx`
- `apps/expo/features/ai/components/ReportModal.tsx`
- `apps/expo/features/ai-packs/screens/AIPacksScreen.tsx`
- `apps/expo/features/catalog/components/CatalogBrowserModal.tsx`
- `apps/expo/features/catalog/screens/PackSelectionScreen.tsx`
- `apps/expo/features/wildlife/screens/IdentificationScreen.tsx`
- `apps/expo/features/catalog/screens/AddCatalogItemDetailsScreen.tsx`
- `apps/expo/features/trail-conditions/components/SubmitConditionReportForm.tsx`
- `apps/expo/app/(app)/trip/location-search.tsx`

## Prevention Strategies

### 1. Architectural Prevention

**Use Enhanced Components by Default**
- Always import TextInput from `expo-app/components/TextInput`
- Always import SearchInput from `expo-app/components/SearchInput`
- These components include the fix automatically

**Component Enhancement Pattern**
- When wrapping third-party input components, include `useKeyboardHideBlur`
- Follow the forwardRef pattern to maintain API compatibility
- Use `useImperativeHandle` to properly forward ref methods

### 2. Development Guidelines

**For New Components:**
```tsx
// ✅ Correct - Use enhanced components
import { TextInput } from 'expo-app/components/TextInput';

// ❌ Wrong - Direct React Native import
import { TextInput } from 'react-native';
```

**For Complex Custom Inputs:**
```tsx
// ✅ Correct - Apply hook directly
const inputRef = useRef(null);
useKeyboardHideBlur(inputRef);

// ❌ Wrong - No keyboard blur handling
const inputRef = useRef(null);
```

### 3. Testing Recommendations

**Unit Tests:**
- Test that `useKeyboardHideBlur` properly subscribes to keyboard events
- Verify that blur() is called when keyboard hides
- Test that event listeners are cleaned up properly

**Integration Tests:**
- Test enhanced components maintain TextInput API compatibility
- Verify ref forwarding works correctly
- Test that existing component behavior is preserved

**E2E Tests:**
- Test keyboard dismissal via back button on Android
- Test keyboard dismissal via tapping outside input
- Verify keyboard reappears on subsequent input focus

### 4. Code Review Checklist

- [ ] New TextInput components use enhanced wrapper or `useKeyboardHideBlur` hook
- [ ] Imports are from `expo-app/components/TextInput` not `react-native`
- [ ] SearchInput imports are from `expo-app/components/SearchInput` not `@packrat/ui/nativewindui`
- [ ] Refs are properly forwarded if component wrapping is needed
- [ ] No direct keyboard event listeners that could conflict

## Related Issues

- **GitHub Issue #1424**: Related search behavior issue in LocationsScreen
- **General Focus Management**: This solution addresses platform-specific focus issues that affect multiple input types

## Cross References

- **Architecture**: [CLAUDE.md](../CLAUDE.md#L79-L96) - Mobile app architecture patterns
- **Testing**: [TESTING.md](../TESTING.md#L57-L61) - Mobile component testing patterns
- **Component Patterns**: Enhanced component pattern can be applied to other third-party UI components

## Verification

The solution successfully resolves the Android keyboard focus issue:

✅ **Automatic Focus Management**: Text inputs automatically lose focus when keyboard is dismissed  
✅ **Consistent Behavior**: Keyboard reappears reliably on subsequent taps  
✅ **Zero Breaking Changes**: Drop-in replacements maintain full API compatibility  
✅ **Performance**: Minimal overhead - single event listener per input  
✅ **Cross-Platform**: Safe on iOS, fixes Android behavior  
✅ **Comprehensive Coverage**: Applied across authentication, chat, search, and form components  

## Future Considerations

1. **Monitor React Native Updates**: Future RN versions may fix this behavior natively
2. **Extend Pattern**: Apply similar enhancement patterns to other third-party input components  
3. **Testing Framework**: Consider adding automated tests that verify keyboard behavior on Android devices
4. **Documentation**: Update component style guides to reference enhanced components as defaults