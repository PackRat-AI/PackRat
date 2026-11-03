import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSetAtom } from 'jotai';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyTemplateErrorAtom } from '../atoms/applyTemplateAtoms';
import { useApplyPackTemplate, usePackTemplateDetails } from '../hooks';
import { useBlockBackWhile } from '../hooks/useBlockBackWhile';
import { TemplateApplyError } from '../utils/applyPackTemplate';

/** Names a new pack, prefilled with the template's name, then fills it. */
export function NewPackFromTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const template = usePackTemplateDetails(id);
  const { createFromTemplate } = useApplyPackTemplate();
  const setListError = useSetAtom(applyTemplateErrorAtom);
  const [name, setName] = useState(template?.name ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBlockBackWhile(isCreating);

  if (!template) {
    return (
      <NotFoundScreen
        title={t('packTemplates.templateNotFound')}
        message={t('packTemplates.pleaseTryAgainLater')}
      />
    );
  }

  const trimmed = name.trim();
  const itemCount = template.items?.length ?? 0;

  const create = async () => {
    if (!trimmed || isCreating) return;
    setError(null);
    setIsCreating(true);
    try {
      const packId = await createFromTemplate({ template, name: trimmed });
      router.dismissTo({ pathname: '/pack-templates/[id]', params: { id: template.id } });
      router.push({ pathname: '/pack/[id]', params: { id: packId } });
    } catch (e) {
      if (e instanceof TemplateApplyError && e.stage === 'itemsNotAdded') {
        // The pack exists; back on the list it's first, one tap from a retry.
        setListError(t('packTemplates.applyFailedRetry'));
        router.back();
      } else {
        setError(t('packTemplates.createPackFailed'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: t('packTemplates.newPack'),
          gestureEnabled: !isCreating,
          headerBackVisible: !isCreating,
        }}
      />
      <KeyboardAwareScrollView
        contentContainerClassName="gap-4 p-4"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {error && (
          <View
            className="flex-row items-center gap-3 rounded-xl bg-destructive/10 p-3"
            testID={testIds.packTemplates.newPackError}
          >
            <Icon name="alert-circle-outline" size={20} color={colors.destructive} />
            <Text className="flex-1 text-sm text-foreground">{error}</Text>
          </View>
        )}
        <TextField
          label={t('packTemplates.packName')}
          value={name}
          onChangeText={setName}
          autoFocus
          editable={!isCreating}
          returnKeyType="done"
          onSubmitEditing={create}
          testID={testIds.packTemplates.newPackName}
        />
        <Text className="text-sm text-muted-foreground">
          {t('packTemplates.newPackFootnote', {
            count: `${itemCount} ${itemCount === 1 ? t('packTemplates.item') : t('packTemplates.items')}`,
            name: template.name,
          })}
        </Text>
        <Button
          onPress={create}
          disabled={!trimmed || isCreating}
          testID={testIds.packTemplates.newPackCreate}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text>{t('packTemplates.create')}</Text>
          )}
        </Button>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
