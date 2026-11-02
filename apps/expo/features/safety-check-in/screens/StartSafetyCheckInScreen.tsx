import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Checkbox } from '@packrat/ui/src/checkbox';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { format } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { getPackItems } from 'expo-app/features/packs/store/packItems';
import {
  FullScreenDialogHeader,
  SectionLabel,
} from 'expo-app/features/trip-stats/components/DialogParts';
import { MenuField } from 'expo-app/features/trip-stats/components/MenuField';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimeField } from '../components/DateTimeField';
import { hasBackgroundPermission, requestBackgroundPermission } from '../lib/locationTracking';
import { loadContacts, startSafetyCheckIn } from '../lib/safetyActions';
import { safetyStore } from '../store/safetyCheckIn';
import type { IdentifyingGearItem } from '../types';
import {
  canBeNotified,
  carryingText,
  DEFAULT_GRACE_MINUTES,
  defaultExpectedReturn,
  GRACE_MINUTE_OPTIONS,
  identifyingGear,
  initialContactIds,
} from '../utils/safetyCheckIn';

type GearDraft = IdentifyingGearItem & { key: number };

/**
 * "Notify your emergency contacts?", the setup after Start Trip, as a Material full-screen dialog.
 * Everything is pre-filled; the user confirms who, when, and what they'll look like, then sends.
 */
export function StartSafetyCheckInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTripDetailsFromStore(id);
  const contacts = use$(safetyStore.contacts);
  const alertRef = useRef<AlertMethods>(null);
  const nextKey = useRef(0);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialContactIds(contacts)));
  const [expectedReturn, setExpectedReturn] = useState(() =>
    defaultExpectedReturn({ trip: trip ?? {}, now: new Date() }),
  );
  const [graceMinutes, setGraceMinutes] = useState<number>(DEFAULT_GRACE_MINUTES);
  const [gear, setGear] = useState<GearDraft[]>(() =>
    identifyingGear(trip?.packId ? (getPackItems(trip.packId) ?? []) : []).map((item) => ({
      ...item,
      key: nextKey.current++,
    })),
  );
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  useEffect(() => {
    void loadContacts();
  }, []);

  // Preselect once contacts arrive, and select any contact added from this screen: someone added
  // here is meant for this trip.
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (knownIds.current === null) {
      if (contacts.length > 0) {
        knownIds.current = new Set(contacts.map((c) => c.id));
        setSelected((current) => (current.size ? current : new Set(initialContactIds(contacts))));
      }
      return;
    }
    const known = knownIds.current;
    const added = contacts.filter((c) => !known.has(c.id) && canBeNotified(c));
    knownIds.current = new Set(contacts.map((c) => c.id));
    if (added.length) setSelected((current) => new Set([...current, ...added.map((c) => c.id)]));
  }, [contacts]);

  const chosen = useMemo(
    () => contacts.filter((c) => selected.has(c.id) && canBeNotified(c)),
    [contacts, selected],
  );

  if (!trip) return null;

  const userName = user?.firstName?.trim() || t('safetyCheckIn.start.you');
  const hasRoute = (trip.plannedRoute?.length ?? 0) >= 2;
  const carrying = carryingText(gear);
  const preview = [
    t('safetyCheckIn.preview.started', {
      name: userName,
      trip: trip.name,
      time: format(expectedReturn, 'EEE d MMM, p'),
    }),
    carrying ? t('safetyCheckIn.preview.carrying', { gear: carrying }) : null,
    t('safetyCheckIn.preview.link'),
  ]
    .filter(Boolean)
    .join(' ');

  const toggleContact = (contactId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });

  const updateGear = (key: number, patch: Partial<IdentifyingGearItem>) =>
    setGear((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const send = (tracking: boolean) => {
    startSafetyCheckIn({
      tripId: trip.id,
      tripName: trip.name,
      contacts: chosen,
      expectedReturnAt: expectedReturn,
      graceMinutes,
      gear,
      trackingEnabled: tracking,
    });
    router.back();
  };

  // Google Play requires a prominent in-app disclosure before asking for background location.
  const confirmSend = async () => {
    if (!trackingEnabled || (await hasBackgroundPermission())) {
      send(trackingEnabled);
      return;
    }
    alertRef.current?.alert({
      title: t('safetyCheckIn.tracking.disclosureTitle'),
      message: t('safetyCheckIn.tracking.disclosureMessage'),
      materialIcon: { name: 'map-marker-radius-outline' },
      buttons: [
        {
          text: t('safetyCheckIn.tracking.disclosureDecline'),
          style: 'cancel',
          onPress: () => send(false),
        },
        {
          text: t('safetyCheckIn.tracking.disclosureAccept'),
          style: 'default',
          onPress: async () => send(await requestBackgroundPermission()),
        },
      ],
    });
  };

  return (
    <View className="flex-1 bg-background">
      <FullScreenDialogHeader
        title={t('safetyCheckIn.start.title')}
        onClose={() => router.back()}
        onSave={confirmSend}
        canSave={chosen.length > 0}
        saveLabel={t('safetyCheckIn.start.send')}
        saveTestID={testIds.safetyCheckIn.sendBtn}
      />
      <KeyboardAvoidingView behavior="height" className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-10">
          <SafeAreaView edges={['bottom']}>
            <SectionLabel>{t('safetyCheckIn.start.whoToTell')}</SectionLabel>
            {contacts.map((contact) => {
              const reachable = canBeNotified(contact);
              return (
                <Pressable
                  key={contact.id}
                  onPress={() => reachable && toggleContact(contact.id)}
                  disabled={!reachable}
                  android_ripple={{ color: colors.grey5 }}
                  className="min-h-14 flex-row items-center gap-4 px-4 py-2"
                  style={{ opacity: reachable ? 1 : 0.5 }}
                  testID={testIds.safetyCheckIn.startContact(contact.id)}
                >
                  <View className="flex-1">
                    <Text variant="body">{contact.name}</Text>
                    <Text variant="footnote" className="text-muted-foreground">
                      {contact.email || t('safetyCheckIn.contacts.noEmail')}
                    </Text>
                  </View>
                  <Checkbox
                    checked={selected.has(contact.id) && reachable}
                    onCheckedChange={() => toggleContact(contact.id)}
                    disabled={!reachable}
                  />
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => router.push('/emergency-contacts/edit')}
              android_ripple={{ color: colors.grey5 }}
              className="min-h-14 flex-row items-center gap-4 px-4"
              testID={testIds.safetyCheckIn.startAddContactBtn}
            >
              <Icon name="account-plus-outline" size={24} color={colors.primary} />
              <Text variant="body" className="text-primary">
                {contacts.length === 0
                  ? t('safetyCheckIn.contacts.addFirst')
                  : t('safetyCheckIn.contacts.add')}
              </Text>
            </Pressable>
            {contacts.length === 0 ? (
              <Text variant="footnote" className="px-4 text-muted-foreground" wrap>
                {t('safetyCheckIn.contacts.emptyHint')}
              </Text>
            ) : contacts.some((c) => !canBeNotified(c)) ? (
              <Text variant="footnote" className="px-4 text-muted-foreground" wrap>
                {t('safetyCheckIn.start.needsEmail')}
              </Text>
            ) : null}

            <SectionLabel>{t('safetyCheckIn.start.whenBack')}</SectionLabel>
            <DateTimeField
              label={t('safetyCheckIn.start.expectedBack')}
              value={expectedReturn}
              onChange={setExpectedReturn}
              minimumDate={new Date()}
              testID={testIds.safetyCheckIn.expectedReturn}
            />
            <MenuField
              label={t('safetyCheckIn.start.alertAfter')}
              options={GRACE_MINUTE_OPTIONS.map(String)}
              value={String(graceMinutes)}
              onChange={(value) => setGraceMinutes(Number(value))}
              optionLabel={(value) =>
                t('safetyCheckIn.start.graceHours', { count: Number(value) / 60 })
              }
              testIDFor={(value) => testIds.safetyCheckIn.graceOption(value)}
            />
            <Text variant="footnote" className="px-4 pt-1 text-muted-foreground" wrap>
              {t('safetyCheckIn.start.alertExplainer', {
                time: format(
                  new Date(expectedReturn.getTime() + graceMinutes * 60_000),
                  "EEE d MMM 'at' p",
                ),
              })}
            </Text>

            <SectionLabel>{t('safetyCheckIn.start.lookLike')}</SectionLabel>
            {gear.map((item) => (
              <View key={item.key} className="flex-row items-center gap-2 px-4 py-1">
                <TextInput
                  value={item.note ?? ''}
                  onChangeText={(note) => updateGear(item.key, { note: note || null })}
                  placeholder={t('safetyCheckIn.start.colour')}
                  placeholderTextColor={colors.grey}
                  maxLength={60}
                  className="min-h-12 w-28 rounded-md border border-border px-3 text-base text-primary"
                />
                <TextInput
                  value={item.name}
                  onChangeText={(name) => updateGear(item.key, { name })}
                  placeholder={t('safetyCheckIn.start.item')}
                  placeholderTextColor={colors.grey}
                  maxLength={100}
                  className="min-h-12 flex-1 rounded-md border border-border px-3 text-base text-foreground"
                />
                <Pressable
                  onPress={() => setGear((current) => current.filter((g) => g.key !== item.key))}
                  hitSlop={8}
                  className="p-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('safetyCheckIn.start.removeItem')}
                  android_ripple={{ borderless: true, color: colors.grey5 }}
                >
                  <Icon name="close" size={20} color={colors.grey} />
                </Pressable>
              </View>
            ))}
            <Button
              variant="text"
              className="ml-2 self-start"
              onPress={() =>
                setGear((current) => [...current, { name: '', note: null, key: nextKey.current++ }])
              }
              testID={testIds.safetyCheckIn.addGearBtn}
            >
              <Icon name="plus" size={18} color={colors.primary} />
              <Text>{t('safetyCheckIn.start.addItem')}</Text>
            </Button>
            <Text variant="footnote" className="px-4 text-muted-foreground" wrap>
              {t('safetyCheckIn.start.lookLikeHint')}
            </Text>

            <View className="mt-4 min-h-14 flex-row items-center gap-4 px-4">
              <Text variant="body" className="flex-1">
                {t('safetyCheckIn.start.followProgress')}
              </Text>
              <Toggle
                value={trackingEnabled}
                onValueChange={setTrackingEnabled}
                testID={testIds.safetyCheckIn.trackingToggle}
              />
            </View>
            <Text variant="footnote" className="px-4 text-muted-foreground" wrap>
              {hasRoute
                ? t('safetyCheckIn.start.followProgressRoute')
                : t('safetyCheckIn.start.followProgressHint')}
            </Text>

            <SectionLabel>{t('safetyCheckIn.start.theyReceive')}</SectionLabel>
            <Text variant="callout" className="px-4 text-muted-foreground" wrap>
              {preview}
            </Text>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}
