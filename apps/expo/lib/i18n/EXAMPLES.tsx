/**
 * Example: How to Use i18n in PackRat
 *
 * This file demonstrates various ways to use the internationalization (i18n)
 * system in the PackRat app.
 */

import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { t } from 'expo-app/lib/i18n';
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
export function InterpolationExample() {
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
export function validateForm(formData: { email?: string }) {
  if (!formData.email) {
    // Using t() directly without the hook
    return { error: t('errors.somethingWentWrong') };
  }
  return { success: true };
}

/**
 * Example 5: Default fallback values
 */
export function FallbackExample() {
  const { t } = useTranslation();

  return (
    <View>
      {/* If translation key doesn't exist, shows the key itself */}
      <Text>{t('someNonExistentKey')}</Text>

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
 * 5. Outside components: import { t } from 'expo-app/lib/i18n';
 *
 * Translation file location: apps/expo/lib/i18n/locales/en.json
 */
