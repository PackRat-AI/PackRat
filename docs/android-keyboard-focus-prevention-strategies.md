# Android Keyboard Focus Prevention Strategies

## Overview
This document outlines comprehensive prevention strategies to avoid Android keyboard focus persistence issues in React Native applications, particularly the issue where TextInput doesn't lose focus after dismissing the keyboard.

## Current Solution Analysis 
✅ **Already Implemented:**
- `useKeyboardHideBlur` hook that listens for `keyboardDidHide` events
- Enhanced `TextInput` and `SearchInput` components with automatic focus management
- Proper component abstraction patterns
- Consistent import patterns (no direct React Native TextInput imports)

## Prevention Strategies

### 1. Architectural Prevention

#### 1.1 Component-Level Standards
```typescript
// ✅ ALWAYS use enhanced components
import { TextInput } from 'expo-app/components/TextInput';
import { SearchInput } from 'expo-app/components/SearchInput';

// ❌ NEVER import directly from React Native
import { TextInput } from 'react-native'; // FORBIDDEN
```

#### 1.2 Custom Hook Integration Pattern
```typescript
// For any new input-related components, always include the hook
import { useKeyboardHideBlur } from 'expo-app/lib/hooks/useKeyboardHideBlur';

export const CustomInput = forwardRef<InputRef, InputProps>((props, ref) => {
  const inputRef = useRef<any>(null);
  
  // REQUIRED: Apply keyboard hide blur fix
  useKeyboardHideBlur(inputRef);
  
  useImperativeHandle(ref, () => inputRef.current);
  return <SomeInputComponent ref={inputRef} {...props} />;
});
```

#### 1.3 Third-Party Component Wrapping
```typescript
// When integrating third-party input components, auto-wrap them
import { SomeThirdPartyInput } from 'some-library';

export const WrappedThirdPartyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);
  useKeyboardHideBlur(inputRef); // Always add this
  useImperativeHandle(ref, () => inputRef.current);
  return <SomeThirdPartyInput ref={inputRef} {...props} />;
});
```

### 2. Process-Based Prevention

#### 2.1 Code Review Checklist
**Mandatory checks for any PR containing input elements:**

- [ ] Does the component use the enhanced `TextInput`/`SearchInput` from `expo-app/components/?
- [ ] Is there any direct import from `react-native` for TextInput?
- [ ] If creating a new input component, does it use `useKeyboardHideBlur`?
- [ ] Are there any third-party input components that need wrapping?
- [ ] Has the component been tested on Android with keyboard dismiss scenarios?
- [ ] Does the component handle ref forwarding correctly?

#### 2.2 Pre-commit Hooks Enhancement
Add to `.githooks/pre-commit` or lefthook:
```bash
# Check for forbidden TextInput imports
if grep -r "import.*TextInput.*from 'react-native'" apps/expo/; then
  echo "❌ Error: Direct TextInput import from react-native detected"
  echo "Use: import { TextInput } from 'expo-app/components/TextInput' instead"
  exit 1
fi

# Check for new input components without useKeyboardHideBlur
if git diff --cached --name-only | grep -E '\.(tsx?)$' | xargs grep -l "forwardRef.*Input" | 
   xargs grep -L "useKeyboardHideBlur"; then
  echo "⚠️  Warning: New input component detected without useKeyboardHideBlur hook"
  echo "Consider adding the hook for Android compatibility"
fi
```

#### 2.3 ESLint Custom Rules
Add to ESLint config:
```json
{
  "rules": {
    "no-direct-textinput-import": {
      "rule": "error",
      "message": "Use enhanced TextInput component instead of direct react-native import"
    }
  }
}
```

### 3. Best Practices for TextInput Implementation

#### 3.1 Component Design Patterns
```typescript
// ✅ PREFERRED: Enhanced component pattern
export const FormInput = forwardRef<TextInputRef, FormInputProps>((props, ref) => {
  const inputRef = useRef<TextInputRef>(null);
  
  // Auto-apply Android keyboard fix
  useKeyboardHideBlur(inputRef);
  
  // Handle validation, formatting, etc.
  const { error, ...inputProps } = processProps(props);
  
  useImperativeHandle(ref, () => inputRef.current!);
  
  return (
    <View>
      <TextInput ref={inputRef} {...inputProps} />
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
});

// ✅ ACCEPTABLE: Hook usage in existing components  
export const LegacyForm = () => {
  const inputRef = useRef(null);
  useKeyboardHideBlur(inputRef); // Retrofit existing components
  
  return <TextInput ref={inputRef} />;
};
```

#### 3.2 Ref Management Best Practices
```typescript
// ✅ CORRECT: Proper ref typing
const inputRef = useRef<TextInput>(null);

// ✅ CORRECT: Forward refs properly
useImperativeHandle(ref, () => inputRef.current!);

// ❌ AVOID: Any typing that loses ref methods
const inputRef = useRef<any>(null);
```

#### 3.3 Props Extension Pattern
```typescript
// When creating component library extensions
interface EnhancedTextInputProps extends TextInputProps {
  autoKeyboardDismiss?: boolean; // Allow opting out if needed
}

export const EnhancedTextInput = forwardRef<TextInput, EnhancedTextInputProps>(
  ({ autoKeyboardDismiss = true, ...props }, ref) => {
    const inputRef = useRef<TextInput>(null);
    
    // Conditional application for rare edge cases
    if (autoKeyboardDismiss) {
      useKeyboardHideBlur(inputRef);
    }
    
    useImperativeHandle(ref, () => inputRef.current!);
    return <RNTextInput ref={inputRef} {...props} />;
  }
);
```

### 4. Testing Strategies

#### 4.1 Unit Tests for Hook Behavior
```typescript
// __tests__/useKeyboardHideBlur.test.ts
import { renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useKeyboardHideBlur } from '../useKeyboardHideBlur';

describe('useKeyboardHideBlur', () => {
  it('should blur input when keyboard hides', () => {
    const mockBlur = jest.fn();
    const mockRef = { current: { blur: mockBlur } };
    
    renderHook(() => useKeyboardHideBlur(mockRef));
    
    // Simulate keyboard hide event
    Keyboard.emit('keyboardDidHide');
    
    expect(mockBlur).toHaveBeenCalled();
  });
  
  it('should clean up listener on unmount', () => {
    const mockRef = { current: { blur: jest.fn() } };
    const { unmount } = renderHook(() => useKeyboardHideBlur(mockRef));
    
    const removeSpy = jest.spyOn(Keyboard, 'removeAllListeners');
    unmount();
    
    expect(removeSpy).toHaveBeenCalled();
  });
});
```

#### 4.2 Integration Tests for Components
```typescript
// __tests__/TextInput.integration.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { TextInput } from '../components/TextInput';

describe('Enhanced TextInput', () => {
  it('should automatically blur on keyboard dismiss', async () => {
    const { getByTestId } = render(
      <TextInput testID="input" placeholder="Test input" />
    );
    
    const input = getByTestId('input');
    
    // Focus the input
    fireEvent(input, 'focus');
    
    // Simulate keyboard dismissal
    Keyboard.emit('keyboardDidHide');
    
    // Verify blur was called (you may need to mock the blur method)
    expect(input.props.onBlur).toHaveBeenCalled();
  });
});
```

#### 4.3 E2E Test Scenarios
```typescript
// e2e/keyboard-behavior.e2e.ts
describe('Android Keyboard Behavior', () => {
  it('should properly dismiss keyboard on Android', async () => {
    await device.launchApp({ newInstance: true });
    
    // Find and tap input
    await element(by.id('search-input')).tap();
    await expect(element(by.id('search-input'))).toBeFocused();
    
    // Type text
    await element(by.id('search-input')).typeText('test query');
    
    // Dismiss keyboard via back button (Android specific)
    await device.pressBack();
    
    // Verify input loses focus and keyboard can reopen
    await element(by.id('search-input')).tap();
    await expect(element(by.id('search-input'))).toBeFocused();
    
    // Type more text to verify keyboard reopened properly
    await element(by.id('search-input')).typeText('more text');
  });
});
```

### 5. Developer Guidelines

#### 5.1 Onboarding Checklist
**For new developers:**
- [ ] Understand the Android keyboard focus persistence issue
- [ ] Know where to find enhanced TextInput components
- [ ] Understand when and how to use `useKeyboardHideBlur`
- [ ] Review existing component patterns in the codebase
- [ ] Test any input-related changes on Android emulator/device

#### 5.2 Component Creation Workflow
1. **Planning Phase**: Identify if component involves text input
2. **Implementation**: Use enhanced components or add `useKeyboardHideBlur`
3. **Testing**: Test keyboard behavior on Android specifically
4. **Code Review**: Follow checklist above
5. **Documentation**: Update component docs with keyboard behavior notes

#### 5.3 Documentation Standards
```typescript
/**
 * Enhanced SearchInput with automatic Android keyboard fix.
 * 
 * @example
 * ```tsx
 * <SearchInput 
 *   placeholder="Search items..."
 *   onChangeText={handleSearch}
 *   // Keyboard will auto-dismiss properly on Android
 * />
 * ```
 * 
 * @note Automatically handles Android keyboard focus persistence via useKeyboardHideBlur
 */
```

### 6. Code Review Guidelines

#### 6.1 High-Risk Areas to Review
- Any new component containing "Input", "Field", or "Text" in the name
- Third-party library integrations with text input capabilities
- Form components and validation libraries
- Search and filter implementations
- Chat/messaging input components

#### 6.2 Review Questions
1. "Does this component handle Android keyboard dismiss correctly?"
2. "Would a user need to restart the app to use keyboard again?"
3. "Is this component tested on Android devices/emulators?"
4. "Does this follow our established input component patterns?"

### 7. Monitoring and Maintenance

#### 7.1 Telemetry Considerations
```typescript
// Optional: Track keyboard behavior issues
export function trackKeyboardIssue(component: string, action: string) {
  Analytics.track('keyboard_behavior', {
    component,
    action,
    platform: Platform.OS,
  });
}
```

#### 7.2 Regular Audits
- Monthly review of new input components
- Quarterly Android-specific testing sessions  
- Annual review of prevention strategies effectiveness

## Implementation Roadmap

### Phase 1: Immediate (Next Sprint)
- [ ] Add pre-commit hooks for TextInput import checking
- [ ] Create ESLint rule for direct react-native TextInput imports
- [ ] Update team documentation with these guidelines
- [ ] Add code review checklist to PR template

### Phase 2: Short-term (Next Month)
- [ ] Implement unit tests for existing hook
- [ ] Create integration tests for enhanced components
- [ ] Add E2E tests for keyboard behavior
- [ ] Audit existing components for compliance

### Phase 3: Long-term (Next Quarter)
- [ ] Create developer onboarding materials
- [ ] Implement telemetry tracking (if desired)
- [ ] Review and update strategies based on real-world usage
- [ ] Consider contributing solution back to React Native community

## Conclusion

These prevention strategies build on your existing solid foundation to create a comprehensive system that should prevent Android keyboard focus persistence issues from occurring in future development. The key is making the correct patterns easy to use and the incorrect patterns hard to implement accidentally.