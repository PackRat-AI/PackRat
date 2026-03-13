/**
 * Example: How to Use i18n in PackRat
 *
 * This file demonstrates various ways to use the internationalization (i18n)
 * system in the PackRat app.
 */

import { t } from 'expo-app/lib/i18n';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Button, Text, View } from 'react-native';

/**
 * Example 1: Basic usage in a component
 */
export function BasicExample() {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t('common.welcome')}</Text>
      <Text>{t('navigation.dashboard')}</Text>
      <Button title={t('common.save')} onPress={() => {}} />
    </View>
  );
}

/**
 * Example 2: Translation with interpolation (variables)
 */
export function InterpolationExample({ userName }: { userName: string }) {
  const { t } = useTranslation();

  return (
    <View>
      {/* Using variables in translations */}
      <Text>{t('profile.memberSince', { date: 'January 1, 2024' })}</Text>
    </View>
  );
}

/**
 * Example 3: Using translations in props
 */
export function PropsExample() {
  const { t } = useTranslation();

  return (
    <View>
      <Button title={t('common.save')} onPress={() => alert(t('common.success'))} />
    </View>
  );
}

/**
 * Example 4: Using translations outside components
 * (e.g., in utility functions, validation, etc.)
 */
export function validateForm(formData: any) {
  if (!formData.email) {
    // Use the configured t() from expo-app/lib/i18n when outside a React component
    return { error: t('errors.somethingWentWrong') };
  }
  return { success: true };
}

/**
 * Example 5: Type safety for translation keys
 *
 * With the `CustomTypeOptions` module augmentation in `i18next.d.ts`, the
 * `t()` function only accepts keys that exist in `en.json`.  TypeScript will
 * report a compile-time error for any unknown or misspelled key:
 *   "Argument of type '"someNonExistentKey"' is not assignable to parameter
 *    of type 'ParseKeys<Ns>'"
 *
 * This ensures missing translations are caught before they reach production.
 * @see https://www.i18next.com/overview/typescript
 */
export function FallbackExample() {
  const { t } = useTranslation();

  return (
    <View>
      {/* TypeScript will error if the key does not exist in en.json */}
      {/* t('someNonExistentKey') ← compile-time error */}

      {/* Best practice: Always add keys to en.json first */}
      <Text>{t('common.welcome')}</Text>
    </View>
  );
}

/**
 * Example 6: Conditional translations
 */
export function ConditionalExample({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useTranslation();

  return (
    <View>
      <Button title={isLoggedIn ? t('auth.logOut') : t('auth.signIn')} onPress={() => {}} />
    </View>
  );
}

/**
 * Example 7: Array of translations
 */
export function ListExample() {
  const { t } = useTranslation();

  const menuItems = [
    { label: t('navigation.dashboard'), route: '/' },
    { label: t('navigation.packs'), route: '/packs' },
    { label: t('navigation.trips'), route: '/trips' },
    { label: t('navigation.catalog'), route: '/catalog' },
    { label: t('navigation.profile'), route: '/profile' },
  ];

  return (
    <View>
      {menuItems.map((item) => (
        <Text key={item.route}>{item.label}</Text>
      ))}
    </View>
  );
}

/**
 * Quick Reference:
 *
 * 1. Import the hook: import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
 * 2. Use in component: const { t } = useTranslation();
 * 3. Translate text: t('section.key')
 * 4. With variables: t('key', { variable: value })
 * 5. Outside components: import { t } from 'expo-app/lib/i18n'; t('key')
 *
 * Translation file location: apps/expo/lib/i18n/locales/en.json
 * TypeScript types: apps/expo/lib/i18n/i18next.d.ts (module augmentation)
 */

