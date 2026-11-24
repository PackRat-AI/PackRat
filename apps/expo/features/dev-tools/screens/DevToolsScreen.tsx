import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { useQueryClient } from '@tanstack/react-query';
import * as Burnt from 'burnt';
import { Icon } from 'expo-app/components/Icon';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { readIntroSeen, resetIntroSeen } from 'expo-app/features/intro';
import { FEATURE_FLAGS_QUERY_KEY, useFeatureFlags } from 'expo-app/hooks/useFeatureFlags';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { testIds } from 'expo-app/lib/testIds';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

/**
 * Developer tools, opened by holding the top-right corner of any screen. Dev
 * and preview builds only. Mirrors the iOS sheet; the longer list of developer
 * actions stays in Settings.
 */
export function DevToolsScreen() {
  const { colors } = useColorScheme();
  const user = useUser();
  const flags = useFeatureFlags();
  const queryClient = useQueryClient();
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  useEffect(() => {
    readIntroSeen()
      .then(setIntroSeen)
      .catch(() => setIntroSeen(null));
  }, []);

  const version = `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`;
  // A debug bundle served by Metro reports whatever APP_VARIANT Metro started
  // with, so trust __DEV__ first.
  const variant = __DEV__
    ? 'development (debug)'
    : ((Constants.expoConfig?.extra?.appVariant as string | undefined) ?? 'unknown');
  const account = user?.email ?? 'Guest or signed out';

  const handleResetIntro = async () => {
    await resetIntroSeen();
    setIntroSeen(false);
    Burnt.toast({ title: 'The intro shows on the next first-launch screen.', preset: 'done' });
  };

  const handleRefreshFlags = async () => {
    try {
      await queryClient.refetchQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY });
      Burnt.toast({ title: 'Feature flags refreshed.', preset: 'done' });
    } catch {
      Burnt.toast({ title: 'Feature flags could not be refreshed.', preset: 'error' });
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 px-4 pb-10 pt-6"
      testID={testIds.devTools.sheet}
    >
      <Text variant="title2" className="font-semibold">
        Developer
      </Text>

      <Section title="Build">
        <Row label="Version" value={version} />
        <Row label="Variant" value={variant} />
        <Row label="API" value={getApiBaseUrl()} />
        <Row label="Account" value={account} last />
      </Section>

      <Section title="Intro">
        <Row
          label="First-launch intro"
          value={introSeen === null ? '…' : introSeen ? 'Seen' : 'Not seen'}
          last
        />
        <View className="flex-row flex-wrap gap-2 p-4 pt-0">
          <Button
            variant="filled"
            label="Show Intro"
            onPress={() => router.push('/intro')}
            testID={testIds.devTools.showIntro}
          />
          <Button
            variant="outlined"
            label="Reset Intro"
            disabled={introSeen === false}
            onPress={handleResetIntro}
            testID={testIds.devTools.resetIntro}
          />
        </View>
      </Section>

      <Section title="Feature Flags">
        {Object.keys(flags)
          .sort()
          .map((key) => {
            const enabled = flags[key as keyof typeof flags];
            return (
              <View key={key} className="flex-row items-center justify-between px-4 py-2.5">
                <Text variant="footnote">{key}</Text>
                <Icon
                  name={enabled ? 'check-circle' : 'circle-outline'}
                  size={20}
                  color={enabled ? '#16a34a' : colors.grey}
                />
              </View>
            );
          })}
        <View className="p-4">
          <Button
            variant="outlined"
            label="Refresh Flags"
            onPress={handleRefreshFlags}
            testID={testIds.devTools.refreshFlags}
          />
        </View>
      </Section>

      <Button
        variant="text"
        label="More Developer Options"
        onPress={() => {
          router.back();
          router.push('/settings');
        }}
        testID={testIds.devTools.moreSettings}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <Text variant="subhead" className="mb-2 font-medium text-muted-foreground">
        {title}
      </Text>
      <View className="rounded-xl border border-border bg-card">{children}</View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      className={`flex-row items-start justify-between gap-4 p-4 ${last ? '' : 'border-b border-border'}`}
    >
      <Text className="font-medium">{label}</Text>
      <Text variant="footnote" className="flex-1 text-right text-muted-foreground" wrap>
        {value}
      </Text>
    </View>
  );
}
