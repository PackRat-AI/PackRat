# Quick Start: Using i18n in PackRat

## For New Developers

### 1. Basic Usage (Most Common)

```tsx
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';

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

### 2. Adding New Translations

Edit `apps/expo/lib/i18n/locales/en.json`:

```json
{
  "myFeature": {
    "title": "My Feature Title",
    "description": "My feature description"
  }
}
```

Then use in your component:

```tsx
<Text>{t('myFeature.title')}</Text>
```

### 3. Translation with Variables

In `en.json`:
```json
{
  "greeting": "Hello, {{name}}!"
}
```

In your component:
```tsx
<Text>{t('greeting', { name: 'John' })}</Text>
```

## Available Translation Keys

Check `apps/expo/lib/i18n/locales/en.json` for all available keys.

Common ones:
- `common.save`, `common.cancel`, `common.delete`, `common.edit`
- `errors.somethingWentWrong`, `errors.notFound`
- `auth.signIn`, `auth.signOut`
- `navigation.dashboard`, `navigation.profile`, `navigation.packs`

## Need Help?

- **Full docs**: `apps/expo/lib/i18n/README.md`
- **Migration guide**: `apps/expo/lib/i18n/MIGRATION.md`
- **Code examples**: `apps/expo/lib/i18n/EXAMPLES.tsx`
- **Summary**: `apps/expo/I18N_SUMMARY.md`

## Find Hardcoded Strings

Run this to find strings that need translation:

```bash
node apps/expo/lib/i18n/extract-strings.js
```

## Common Mistakes to Avoid

❌ **Don't**: Hardcode text
```tsx
<Text>Welcome to PackRat</Text>
```

✅ **Do**: Use translations
```tsx
const { t } = useTranslation();
<Text>{t('common.welcome')}</Text>
```

❌ **Don't**: Forget to add translation keys
```tsx
<Text>{t('nonexistent.key')}</Text> // Will show 'nonexistent.key'
```

✅ **Do**: Add keys to en.json first
```json
// In en.json
{ "mySection": { "myKey": "My Text" } }
```

## That's It!

You're ready to use i18n in the PackRat app. Start with the basic usage pattern above, and check the full docs when you need more advanced features.
