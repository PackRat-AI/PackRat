import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadContacts, removeContact } from '../lib/safetyActions';
import { safetyStore } from '../store/safetyCheckIn';
import type { EmergencyContact } from '../types';
import { canBeNotified } from '../utils/safetyCheckIn';

/** Settings › Emergency contacts: the people told when a trip starts and alerted if it runs late. */
export function EmergencyContactsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const contacts = use$(safetyStore.contacts);
  const alertRef = useRef<AlertMethods>(null);
  const [loaded, setLoaded] = useState(contacts.length > 0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadContacts().finally(() => setLoaded(true));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  }, []);

  const edit = (contact?: EmergencyContact) =>
    router.push(contact ? `/emergency-contacts/edit?id=${contact.id}` : '/emergency-contacts/edit');

  const confirmDelete = (contact: EmergencyContact) =>
    alertRef.current?.alert({
      title: t('safetyCheckIn.contacts.removeTitle', { name: contact.name }),
      message: t('safetyCheckIn.contacts.removeMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('safetyCheckIn.contacts.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContact(contact.id);
            } catch {
              alertRef.current?.alert({
                title: t('safetyCheckIn.contacts.removeFailed'),
                message: t('safetyCheckIn.contacts.checkConnection'),
                buttons: [{ text: t('common.ok'), style: 'default' }],
              });
            }
          },
        },
      ],
    });

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => edit()}
              hitSlop={8}
              className="p-2"
              accessibilityRole="button"
              accessibilityLabel={t('safetyCheckIn.contacts.add')}
              testID={testIds.safetyCheckIn.contactsAddBtn}
            >
              <Icon name="plus" size={24} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="p-4 pb-10 gap-3"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {contacts.length === 0 && loaded ? (
          <View className="items-center gap-3 px-6 pt-16">
            <Icon name="account-heart-outline" size={56} color={colors.primary} />
            <Text variant="title3" className="text-center font-semibold">
              {t('safetyCheckIn.contacts.emptyTitle')}
            </Text>
            <Text variant="callout" className="text-center text-muted-foreground" wrap>
              {t('safetyCheckIn.contacts.emptyHint')}
            </Text>
            <Button
              variant="filled"
              className="mt-2 gap-2"
              onPress={() => edit()}
              testID={testIds.safetyCheckIn.contactsAddEmptyBtn}
            >
              <Icon name="account-plus-outline" size={18} color="white" />
              <Text className="font-medium text-primary-foreground">
                {t('safetyCheckIn.contacts.add')}
              </Text>
            </Button>
          </View>
        ) : (
          <>
            <View className="overflow-hidden rounded-xl border border-border bg-card">
              {contacts.map((contact, index) => (
                <Pressable
                  key={contact.id}
                  onPress={() => edit(contact)}
                  android_ripple={{ color: colors.grey5 }}
                  className={`min-h-16 flex-row items-center gap-3 py-2 pl-4 pr-1 ${
                    index > 0 ? 'border-t border-border' : ''
                  }`}
                  testID={testIds.safetyCheckIn.contactRow(contact.id)}
                >
                  <Icon name="account-circle" size={36} color={colors.primary} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text variant="body" className="font-semibold">
                        {contact.name}
                      </Text>
                      {contact.isDefault ? (
                        <View className="rounded-full bg-primary/15 px-2 py-0.5">
                          <Text variant="caption2" className="font-semibold text-primary">
                            {t('safetyCheckIn.contacts.default')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      variant="subhead"
                      className={
                        canBeNotified(contact) ? 'text-muted-foreground' : 'text-destructive'
                      }
                    >
                      {contact.email || t('safetyCheckIn.contacts.noEmail')}
                    </Text>
                  </View>
                  <DropdownMenu
                    items={[
                      createDropdownItem({ actionKey: 'edit', title: t('common.edit') }),
                      createDropdownItem({
                        actionKey: 'remove',
                        title: t('safetyCheckIn.contacts.remove'),
                        destructive: true,
                      }),
                    ]}
                    onItemPress={(item) => {
                      if (item.actionKey === 'edit') edit(contact);
                      else if (item.actionKey === 'remove') confirmDelete(contact);
                    }}
                  >
                    <View
                      className="h-10 w-10 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={t('safetyCheckIn.contacts.options', {
                        name: contact.name,
                      })}
                    >
                      <Icon name="dots-vertical" size={22} color={colors.grey} />
                    </View>
                  </DropdownMenu>
                </Pressable>
              ))}
            </View>
            <Text variant="footnote" className="px-1 text-muted-foreground" wrap>
              {t('safetyCheckIn.contacts.footer')}
            </Text>
          </>
        )}
      </ScrollView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}
