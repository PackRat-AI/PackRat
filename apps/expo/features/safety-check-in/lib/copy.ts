import type { TranslationFunction } from 'expo-app/lib/i18n/types';

/** "Mom", "Mom and Dad", "Mom and 2 others", or "your contacts". */
export function contactSummary({ names, t }: { names: readonly string[]; t: TranslationFunction }) {
  const [first, second] = names;
  if (!first) return t('safetyCheckIn.contacts.yourContacts');
  if (names.length === 1) return first;
  if (names.length === 2 && second) return t('safetyCheckIn.contacts.pair', { first, second });
  return t('safetyCheckIn.contacts.many', { first, count: names.length - 1 });
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
