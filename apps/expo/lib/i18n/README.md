# Internationalization (i18n) Setup

This app uses `expo-localization`, `i18next`, and `react-i18next` to provide localization support with full compile-time TypeScript type safety.

TypeScript types are set up following the official i18next documentation:
https://www.i18next.com/overview/typescript

## Structure

```
apps/expo/lib/
├── i18n/
│   ├── index.ts           # i18next configuration + `resources as const`
│   ├── i18next.d.ts       # TypeScript module augmentation (CustomTypeOptions)
│   ├── types.ts           # Re-exports TranslationKeys convenience type
│   └── locales/
│       └── en.json        # English translations
└── hooks/
    └── useTranslation.ts  # Re-exports useTranslation from react-i18next
```

## How Type Safety Works

The `i18next.d.ts` file augments the `i18next` module with `CustomTypeOptions`:

```ts
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
```

This wires the exact shape of `en.json` into i18next's type system.  The
`t()` function — from `useTranslation()` or `i18next.t()` directly — will
**only accept keys that exist in `en.json`** and will report a compile-time
error for any unknown or misspelled key.  No manual maintenance of a key list
is required.

## Usage

### Basic Translation

Import the `useTranslation` hook in your component:

```tsx
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{t('common.welcome')}</Text>
      <Text>{t('navigation.dashboard')}</Text>
    </View>
  );
}
```

### Translation with Variables

For translations that need dynamic values, use the second parameter:

```tsx
const { t } = useTranslation();

// Translation key in en.json: "memberSince": "Member since {{date}}"
<Text>{t('profile.memberSince', { date: formatDate(user.joinedAt) })}</Text>
```

### Direct Translation (without hook)

For use outside of React components:

```tsx
import i18next from 'i18next';

const message = i18next.t('errors.somethingWentWrong');
```

## Translation Keys

All translation keys are organized into logical sections in `lib/i18n/locales/en.json`:

- `common` - Common UI elements (buttons, labels, etc.)
- `errors` - Error messages
- `auth` - Authentication related text
- `profile` - User profile screens
- `navigation` - Navigation labels
- `packs` - Pack management
- `items` - Item management
- `trips` - Trip planning
- `catalog` - Item catalog
- `welcome` - Welcome/onboarding screens
- `ai` - AI assistant features
- `weather` - Weather information
- `location` - Location features
- `shopping` - Shopping list
- `admin` - Admin panel
- `seasons` - Season suggestions
- `experience` - Experience levels

## Adding New Translations

1. Add the English text to `lib/i18n/locales/en.json` in the appropriate section
2. Use the translation key in your component with `t('section.key')`

The TypeScript types update automatically — no changes to `types.ts` or any
declaration file are needed.

Example:
```json
// In en.json
{
  "myFeature": {
    "title": "My Feature Title",
    "description": "This is a description"
  }
}
```

```tsx
// In your component
const { t } = useTranslation();
<Text>{t('myFeature.title')}</Text>
<Text>{t('myFeature.description')}</Text>
```

## Adding Support for Additional Languages

When ready to add support for other languages:

1. Create a new JSON file in `lib/i18n/locales/` (e.g., `es.json` for Spanish)
2. Copy the structure from `en.json` and translate the values
3. Import the new locale in `lib/i18n/index.ts` and add it to `resources`:
   ```typescript
   import es from './locales/es.json';

   export const resources = {
     en: { translation: en },
     es: { translation: es },
   } as const;
   ```

The app will automatically use the device's language if available, falling back to English otherwise.

## Best Practices

1. **Always use translation keys** - Never hardcode user-facing text in components
2. **Keep keys organized** - Use logical groupings (common, errors, features, etc.)
3. **Be consistent** - Use similar naming patterns for similar concepts
4. **Test with long text** - Some languages have longer text than English
5. **Use variables for dynamic content** - Use `{{variableName}}` syntax for interpolation

## Migration Guide

To migrate existing hardcoded text to use translations:

1. Find the hardcoded text in your component
2. Add an appropriate translation key to `en.json`
3. Replace the hardcoded text with `t('your.key')`
4. Import `useTranslation` hook if not already imported

Before:
```tsx
<Text>Welcome to PackRat</Text>
<Button>Save</Button>
```

After:
```tsx
const { t } = useTranslation();
<Text>{t('common.welcome')}</Text>
<Button>{t('common.save')}</Button>
```

## Examples in the Codebase

Several files have been updated to demonstrate proper i18n usage:

- `components/ErrorState.tsx` - Error component
- `screens/ConsentWelcomeScreen.tsx` - Welcome screen
- `screens/ProfileScreen.tsx` - Profile screen
- `app/(app)/(tabs)/_layout.tsx` - Tab navigation
- `app/(app)/(tabs)/profile/index.tsx` - Profile page
- `features/ai/components/ErrorState.tsx` - AI error state

Review these files to see patterns for implementing translations in your own components.

