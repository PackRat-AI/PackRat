import { use$ } from '@legendapp/state/react';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import {
  FullScreenDialogHeader,
  OutlinedField,
} from 'expo-app/features/trip-stats/components/DialogParts';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Contact, requestPermissionsAsync } from 'expo-contacts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadContacts, saveContact } from '../lib/safetyActions';
import { safetyStore } from '../store/safetyCheckIn';
import type { EmergencyContact } from '../types';
import { looksLikeEmail } from '../utils/safetyCheckIn';

/**
 * Add or edit one emergency contact. An edit waits for the contact to load, so it can never fall
 * through to adding a duplicate; if the contact is gone, the dialog closes.
 */
export function EmergencyContactFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = use$(() => safetyStore.contacts.get().find((c) => c.id === id));
  const missing = Boolean(id) && !existing;
  const [loading, setLoading] = useState(missing);

  // Load once, for the contact the dialog opened with.
  useEffect(() => {
    if (missing) void loadContacts().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (missing && !loading) router.back();
  }, [missing, loading, router]);

  if (missing) return <View className="flex-1 bg-background" />;
  return <ContactForm key={existing?.id ?? 'new'} existing={existing} />;
}

/** The form itself, seeded once from the contact being edited. Can fill itself from the phone's contacts. */
function ContactForm({ existing }: { existing: EmergencyContact | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();

  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const emailInvalid = trimmedEmail.length > 0 && !looksLikeEmail(trimmedEmail);
  const canSave = !saving && name.trim().length > 0 && trimmedEmail.length > 0 && !emailInvalid;

  const pickFromContacts = async () => {
    setErrorMessage(null);
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(t('safetyCheckIn.form.contactsDenied'));
        return;
      }
      const picked = await Contact.presentPicker();
      if (!picked) return;
      const [fullName, emails] = await Promise.all([picked.getFullName(), picked.getEmails()]);
      if (fullName) setName(fullName);
      // Always replace the email, so a new name is never saved with someone else's address.
      const address = emails.find((e) => e.address)?.address ?? '';
      setEmail(address);
      if (!address) setErrorMessage(t('safetyCheckIn.form.pickedNoEmail'));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'safetyCheckIn', action: 'pickContact' },
      });
    }
  };

  const save = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await saveContact({
        id: existing?.id,
        name: name.trim(),
        email: trimmedEmail,
        // Phone isn't edited here; an existing number is kept as is.
        phone: existing?.phone ?? null,
        isDefault,
      });
      router.back();
    } catch {
      setErrorMessage(t('safetyCheckIn.form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <FullScreenDialogHeader
              title={
                existing ? t('safetyCheckIn.form.editTitle') : t('safetyCheckIn.form.newTitle')
              }
              onClose={() => router.back()}
              onSave={save}
              canSave={canSave}
              saveTestID={testIds.safetyCheckIn.contactSaveBtn}
            />
          ),
        }}
      />
      <KeyboardAvoidingView behavior="height" className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled">
          <SafeAreaView edges={['bottom']} className="gap-1 pt-1">
            <Pressable
              onPress={pickFromContacts}
              android_ripple={{ color: colors.grey5 }}
              className="min-h-14 flex-row items-center gap-4 px-4"
              testID={testIds.safetyCheckIn.contactPickBtn}
            >
              <Icon name="card-account-details-outline" size={24} color={colors.primary} />
              <Text variant="body" className="text-primary">
                {t('safetyCheckIn.form.chooseFromContacts')}
              </Text>
            </Pressable>
            <OutlinedField
              label={t('safetyCheckIn.form.name')}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={100}
              testID={testIds.safetyCheckIn.contactNameInput}
            />
            <OutlinedField
              label={t('safetyCheckIn.form.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              testID={testIds.safetyCheckIn.contactEmailInput}
            />
            <Text
              variant="footnote"
              className={`px-4 ${emailInvalid ? 'text-destructive' : 'text-muted-foreground'}`}
              wrap
            >
              {emailInvalid
                ? t('safetyCheckIn.form.emailInvalid')
                : t('safetyCheckIn.form.emailHint')}
            </Text>
            <View className="mt-3 min-h-14 flex-row items-center gap-4 px-4">
              <View className="flex-1">
                <Text variant="body">{t('safetyCheckIn.form.default')}</Text>
                <Text variant="footnote" className="text-muted-foreground" wrap>
                  {t('safetyCheckIn.form.defaultHint')}
                </Text>
              </View>
              <Toggle
                value={isDefault}
                onValueChange={setIsDefault}
                testID={testIds.safetyCheckIn.contactDefaultToggle}
              />
            </View>
            {errorMessage ? (
              <Text variant="callout" className="px-4 pt-2 text-destructive" wrap>
                {errorMessage}
              </Text>
            ) : null}
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
