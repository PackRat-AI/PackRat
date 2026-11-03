import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { SegmentedControl } from '@packrat/ui/src/segmented-control';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  useBlockedPeople,
  useSocialSettings,
  useUpdateSocialSettings,
} from '../hooks/useSocialSettings';
import type { SocialSettings } from '../types';
import { feedErrorMessage } from '../utils/errorCopy';

function Section({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text variant="subhead" className="px-1 font-medium">
        {title}
      </Text>
      <View className="rounded-xl border border-border bg-card">{children}</View>
      {footer ? (
        <Text variant="footnote" className="px-1 text-muted-foreground" wrap>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** Who can tag the user, which feed activity notifies them, and who they have blocked. */
export function FeedSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const alertRef = useRef<AlertMethods>(null);
  const settings = useSocialSettings();
  const blocked = useBlockedPeople();
  const update = useUpdateSocialSettings();

  const set = (changes: Partial<SocialSettings>) =>
    update.mutate(changes, {
      onError: (error) =>
        alertRef.current?.alert({
          title: t('feed.settingFailed'),
          message: feedErrorMessage({ error: error, fallback: t('feed.somethingWentWrong') }),
          buttons: [{ text: t('feed.ok') }],
        }),
    });

  const current = settings.data;
  const toggles: {
    key: 'notifyTags' | 'notifyComments' | 'notifyReplies';
    label: string;
    testID: string;
  }[] = [
    { key: 'notifyTags', label: t('feed.notifyTags'), testID: testIds.feed.settingsNotifyTags },
    {
      key: 'notifyComments',
      label: t('feed.notifyComments'),
      testID: testIds.feed.settingsNotifyComments,
    },
    {
      key: 'notifyReplies',
      label: t('feed.notifyReplies'),
      testID: testIds.feed.settingsNotifyReplies,
    },
  ];

  return (
    <View className="flex-1 bg-background" testID={testIds.feed.settings}>
      <Stack.Screen options={{ title: t('feed.feedSettings') }} />
      {settings.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : !current ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-muted-foreground">{t('feed.settingsLoadFailed')}</Text>
          <Pressable
            onPress={() => settings.refetch()}
            className="h-10 justify-center rounded-full border border-border px-4"
            accessibilityRole="button"
          >
            <Text variant="callout" className="font-medium text-primary">
              {t('feed.tryAgain')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-6 p-4 pb-10">
          <Section
            title={t('feed.tagging')}
            footer={current.allowTagging ? t('feed.taggingAnyone') : t('feed.taggingNoOne')}
          >
            <View className="flex-row items-center justify-between gap-4 p-4">
              <Text className="flex-1 font-medium">{t('feed.whoCanTag')}</Text>
              <View className="w-44">
                <SegmentedControl
                  values={[t('feed.anyone'), t('feed.noOne')]}
                  selectedIndex={current.allowTagging ? 0 : 1}
                  onIndexChange={(index) => set({ allowTagging: index === 0 })}
                  testID={testIds.feed.settingsTagging}
                />
              </View>
            </View>
          </Section>

          <Section title={t('feed.notifications')} footer={t('feed.notificationsBody')}>
            {toggles.map((toggle, index) => (
              <View
                key={toggle.key}
                className={`flex-row items-center justify-between gap-4 p-4${
                  index > 0 ? ' border-t border-border' : ''
                }`}
              >
                <Text className="flex-1 font-medium">{toggle.label}</Text>
                <Toggle
                  value={current[toggle.key]}
                  onValueChange={(on) => set({ [toggle.key]: on })}
                  testID={toggle.testID}
                />
              </View>
            ))}
          </Section>

          <Section title={t('feed.blockedPeople')} footer={t('feed.blockedPeopleBody')}>
            <Pressable
              onPress={() => router.push('/feed/blocked')}
              className="min-h-[56px] flex-row items-center justify-between gap-4 px-4"
              android_ripple={{ color: colors.grey5 }}
              accessibilityRole="button"
              testID={testIds.feed.settingsBlocked}
            >
              <Text className="flex-1 font-medium">{t('feed.blockedPeople')}</Text>
              <Text className="text-muted-foreground">
                {blocked.data
                  ? blocked.data.length === 0
                    ? t('feed.none')
                    : String(blocked.data.length)
                  : ''}
              </Text>
              <Icon name="chevron-right" size={20} color={colors.grey} />
            </Pressable>
          </Section>
        </ScrollView>
      )}
      <Alert ref={alertRef} title="" buttons={[]} />
    </View>
  );
}
