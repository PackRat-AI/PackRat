# i18n Migration Guide

This guide helps you migrate existing components to use the i18n translation system.

## Quick Start

1. **Import the translation hook:**
   ```tsx
   import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
   ```

2. **Use in your component:**
   ```tsx
   function MyComponent() {
     const { t } = useTranslation();
     
     return <Text>{t('common.welcome')}</Text>;
   }
   ```

## Step-by-Step Migration

### Step 1: Identify Hardcoded Strings

Find all user-facing text in your component:
- Text content in `<Text>` components
- Button titles
- Labels
- Error messages
- Placeholder text
- Alert messages

### Step 2: Add Translation Keys

Add the strings to `lib/i18n/locales/en.json`:

```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a description",
    "button": "Click me"
  }
}
```

### Step 3: Import the Hook

Add the import at the top of your component file:

```tsx
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
```

### Step 4: Replace Hardcoded Strings

Replace each hardcoded string with a translation call:

**Before:**
```tsx
function MyComponent() {
  return (
    <View>
      <Text>Welcome to PackRat</Text>
      <Button title="Save" onPress={handleSave} />
    </View>
  );
}
```

**After:**
```tsx
function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{t('common.welcome')}</Text>
      <Button title={t('common.save')} onPress={handleSave} />
    </View>
  );
}
```

## Common Patterns

### Pattern 1: Simple Text

**Before:**
```tsx
<Text>Dashboard</Text>
```

**After:**
```tsx
const { t } = useTranslation();
<Text>{t('navigation.dashboard')}</Text>
```

### Pattern 2: Text with Variables

**Before:**
```tsx
<Text>Member since {formatDate(user.joinedAt)}</Text>
```

**After:**
```tsx
// In en.json: "memberSince": "Member since {{date}}"
const { t } = useTranslation();
<Text>{t('profile.memberSince', { date: formatDate(user.joinedAt) })}</Text>
```

### Pattern 3: Conditional Text

**Before:**
```tsx
<Button title={isLoggedIn ? 'Log Out' : 'Sign In'} />
```

**After:**
```tsx
const { t } = useTranslation();
<Button title={isLoggedIn ? t('auth.logOut') : t('auth.signIn')} />
```

### Pattern 4: Array/List Items

**Before:**
```tsx
const tabs = [
  { label: 'Dashboard', icon: 'home' },
  { label: 'Profile', icon: 'user' },
];
```

**After:**
```tsx
const { t } = useTranslation();
const tabs = [
  { label: t('navigation.dashboard'), icon: 'home' },
  { label: t('navigation.profile'), icon: 'user' },
];
```

### Pattern 5: Default Values

**Before:**
```tsx
function MyComponent({ title = 'Default Title' }) {
  return <Text>{title}</Text>;
}
```

**After:**
```tsx
function MyComponent({ title }: { title?: string }) {
  const { t } = useTranslation();
  return <Text>{title ?? t('myFeature.defaultTitle')}</Text>;
}
```

### Pattern 6: Alert/Toast Messages

**Before:**
```tsx
Alert.alert('Success', 'Your changes have been saved');
```

**After:**
```tsx
const { t } = useTranslation();
Alert.alert(t('common.success'), t('messages.changesSaved'));
```

## Naming Conventions

Use these conventions for translation keys:

- **Common UI elements:** `common.buttonName`
- **Feature-specific:** `featureName.elementName`
- **Error messages:** `errors.errorType`
- **Success messages:** `messages.messageType`
- **Form labels:** `forms.fieldName`
- **Navigation:** `navigation.tabName`

## Examples from Codebase

### Example 1: ErrorState Component

**Before:**
```tsx
export const ErrorState = ({ title = 'Something went wrong', retryText = 'Retry' }) => {
  return (
    <View>
      <Text>{title}</Text>
      <Button>{retryText}</Button>
    </View>
  );
};
```

**After:**
```tsx
export const ErrorState = ({ title, retryText }) => {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{title ?? t('errors.somethingWentWrong')}</Text>
      <Button>{retryText ?? t('common.retry')}</Button>
    </View>
  );
};
```

### Example 2: Profile Screen

**Before:**
```tsx
const DATA = [
  { id: 'name', title: 'Name', value: displayName },
  { id: 'email', title: 'Email', value: email },
];
```

**After:**
```tsx
const { t } = useTranslation();
const DATA = [
  { id: 'name', title: t('common.name'), value: displayName },
  { id: 'email', title: t('common.email'), value: email },
];
```

## Checklist

Use this checklist when migrating a component:

- [ ] Identify all hardcoded user-facing strings
- [ ] Add translation keys to `en.json`
- [ ] Import `useTranslation` hook
- [ ] Replace hardcoded strings with `t()` calls
- [ ] Test the component
- [ ] Remove old hardcoded strings
- [ ] Update any tests if needed

## Tips

1. **Start small**: Migrate one component at a time
2. **Group related strings**: Keep related translations together in `en.json`
3. **Be consistent**: Use similar patterns for similar UI elements
4. **Test thoroughly**: Verify all text displays correctly
5. **Consider context**: Some strings might need different translations in different contexts

## Helper Script

Run the string extraction script to find hardcoded strings:

```bash
node apps/expo/lib/i18n/extract-strings.js
```

This will scan your components and list potential strings that need translation.

## Getting Help

- See `lib/i18n/README.md` for general i18n documentation
- See `lib/i18n/EXAMPLES.tsx` for code examples
- Check existing migrated components for patterns:
  - `components/ErrorState.tsx`
  - `screens/ConsentWelcomeScreen.tsx`
  - `screens/ProfileScreen.tsx`
  - `app/(app)/(tabs)/_layout.tsx`
