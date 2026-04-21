# Android TextInput Development Checklist

Use this checklist for any PR that involves text input components to prevent Android keyboard focus persistence issues.

## Pre-Development Checklist

- [ ] I understand the Android keyboard focus persistence issue
- [ ] I know to use enhanced components from `expo-app/components/`
- [ ] I have reviewed existing patterns in the codebase
- [ ] I have access to an Android device or emulator for testing

## Implementation Checklist

### For New Input Components
- [ ] Used `import { TextInput } from 'expo-app/components/TextInput'` instead of React Native
- [ ] Used `import { SearchInput } from 'expo-app/components/SearchInput'` for search functionality
- [ ] If creating custom input component, included `useKeyboardHideBlur(inputRef)`
- [ ] Added proper ref forwarding with `useImperativeHandle`
- [ ] Component follows forwardRef pattern: `forwardRef<RefType, PropsType>`

### For Third-Party Components
- [ ] Third-party input component is wrapped with enhanced functionality
- [ ] Applied `useKeyboardHideBlur` hook to third-party component refs
- [ ] Tested keyboard behavior with third-party component on Android
- [ ] Documented any special handling required

### For Form Components
- [ ] All text inputs use enhanced components
- [ ] Form validation doesn't interfere with keyboard management
- [ ] Multiple inputs handle focus transitions properly
- [ ] Submit/done actions work after keyboard dismissal

## Code Review Checklist

### Imports Review
- [ ] No direct `import { TextInput } from 'react-native'` found
- [ ] All input components use enhanced versions
- [ ] Third-party input libraries properly wrapped

### Component Structure Review
- [ ] New input components use `useKeyboardHideBlur` hook
- [ ] Refs are properly typed and forwarded
- [ ] Component follows established patterns
- [ ] Props are properly typed and passed through

### Android-Specific Review
- [ ] Component handles keyboard dismiss events
- [ ] Focus state is properly managed
- [ ] No infinite focus loops possible
- [ ] Works with Android hardware back button

## Testing Checklist

### Unit Tests
- [ ] Component renders correctly
- [ ] Ref forwarding works properly
- [ ] `useKeyboardHideBlur` hook is applied
- [ ] Props are passed through correctly
- [ ] Event handlers work as expected

### Integration Tests
- [ ] Component integrates with form libraries
- [ ] Keyboard events trigger expected behaviors
- [ ] Focus state changes are handled
- [ ] Multiple inputs work together

### Manual Testing (Android Required)
- [ ] **Initial focus works**: Tap input → keyboard appears → can type
- [ ] **Keyboard dismiss works**: Press back button → keyboard disappears
- [ ] **Refocus works**: Tap input again → keyboard reappears → can type
- [ ] **Multiple dismissals work**: Repeat dismiss/refocus 3+ times
- [ ] **Text persistence**: Text remains after keyboard dismissal
- [ ] **Form flows work**: Tab between inputs, submit forms
- [ ] **Navigation works**: Navigate away/back with focused input

### Edge Case Testing
- [ ] Rapid focus changes don't break behavior
- [ ] Screen rotation maintains proper behavior
- [ ] App backgrounding/foregrounding works
- [ ] Memory pressure doesn't affect keyboard behavior

## Performance Checklist
- [ ] No memory leaks from keyboard listeners
- [ ] Smooth keyboard animations
- [ ] No performance degradation after multiple uses
- [ ] Proper cleanup in useEffect hooks

## Documentation Checklist
- [ ] Component documentation mentions Android keyboard behavior
- [ ] Props and ref usage clearly documented
- [ ] Examples show proper implementation
- [ ] Breaking changes (if any) are documented

## Deployment Checklist
- [ ] Changes tested on Android device/emulator
- [ ] No regressions on iOS
- [ ] Edge cases tested in production-like environment
- [ ] Analytics/monitoring set up (if applicable)

## Post-Deployment Checklist
- [ ] Monitor for any keyboard-related bug reports
- [ ] Verify analytics show expected keyboard usage patterns
- [ ] Team feedback collected on new patterns
- [ ] Documentation updated based on lessons learned

## Emergency Rollback Checklist
If keyboard issues are discovered in production:

- [ ] Identify affected components
- [ ] Apply `useKeyboardHideBlur` as hotfix
- [ ] Test fix on Android
- [ ] Deploy hotfix
- [ ] Update prevention strategies based on incident

## Tools and Commands

```bash
# Run unit tests
bun test:expo 

# Test specific component
bun test TextInput.test.tsx

# Run E2E tests (Android)
bun test:e2e:android

# Lint for input-related issues
bun lint --fix
```

## Common Mistakes to Avoid

❌ **Don't do this:**
```typescript
import { TextInput } from 'react-native';  // Direct import
<TextInput onChangeText={...} />  // No ref
```

✅ **Do this instead:**
```typescript
import { TextInput } from 'expo-app/components/TextInput';
const ref = useRef(null);
<TextInput ref={ref} onChangeText={...} />
```

❌ **Don't do this:**
```typescript
// Custom input without keyboard fix
export const MyInput = (props) => (
  <SomeInputComponent {...props} />
);
```

✅ **Do this instead:**
```typescript
export const MyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);
  useKeyboardHideBlur(inputRef);  // Always add this
  useImperativeHandle(ref, () => inputRef.current);
  return <SomeInputComponent ref={inputRef} {...props} />;
});
```

## Resources
- [Prevention Strategies Document](./android-keyboard-focus-prevention-strategies.md)
- [useKeyboardHideBlur Hook](../apps/expo/lib/hooks/useKeyboardHideBlur.tsx)
- [Enhanced TextInput Component](../apps/expo/components/TextInput.tsx)
- [Enhanced SearchInput Component](../apps/expo/components/SearchInput.tsx)