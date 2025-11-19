import {
  ActivityIndicator,
  Alert,
  type AlertRef,
  Button,
  LargeTitleHeader,
  Text,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { PackCard } from 'expo-app/features/packs/components/PackCard';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { useGeneratePacks } from '../hooks/useGeneratedPacks';

export function AIPacksScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const alertRef = useRef<AlertRef>(null);
  const { mutateAsync: generatePacks, isPending, generatedPacksFromStore } = useGeneratePacks();
  const [packsModalVisible, setPacksModalVisible] = useState(false);
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      count: 3,
    },
    onSubmit: async ({ value }) => {
      try {
        const packs = await generatePacks(value);
        alertRef.current?.alert({
          title: t('ai.packsGenerated'),
          message: t('ai.successfullyGenerated', { count: packs.length }),
          materialIcon: { name: 'backpack', color: colors.green },
          buttons: [
            { text: t('ai.return'), onPress: () => {} },
            {
              text: t('ai.view'),
              onPress: () => {
                setPacksModalVisible(true);
              },
            },
          ],
        });
      } catch (error) {
        alertRef.current?.alert({
          title: t('common.error'),
          message: t('ai.failedToGenerate'),
          materialIcon: { name: 'exclamation', color: colors.destructive },
          buttons: [{ text: t('common.ok'), onPress: () => {} }],
        });
        console.error('Error generating packs:', error);
      }
    },
  });

  const handleGeneratePacks = () => {
    alertRef.current?.alert({
      title: t('ai.generatePacksButton'),
      message: t('ai.generatePacksConfirm', { count: form.getFieldValue('count') }),
      materialIcon: { name: 'information-outline', color: colors.primary },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('ai.generatePacksButton'),
          onPress: () => form.handleSubmit(),
          style: 'default',
        },
      ],
    });
  };

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader title={t('ai.aiPacksAdmin')} backVisible={true} />

      <View className="px-4 py-6 space-y-6">
        {/* Generation Form */}
        <View className="bg-card p-4 rounded-xl">
          <Text className="text-lg font-semibold mb-4">{t('ai.generateNewPacks')}</Text>

          <form.Field name="count">
            {(field) => (
              <View className="space-y-2">
                <TextInput
                  className="border border-border rounded-lg px-3 py-2 text-foreground bg-background"
                  value={field.state.value.toString()}
                  onChangeText={(text) => field.handleChange(Number.parseInt(text) || 1)}
                  keyboardType="numeric"
                  placeholder={t('ai.enterCount')}
                />
                <Text variant="caption2">{t('ai.numberOfPacksToGenerate')}</Text>
              </View>
            )}
          </form.Field>

          <View className="mt-4">
            <Button onPress={handleGeneratePacks} disabled={isPending} className="w-full">
              {isPending ? (
                <View className="flex-row items-center space-x-2">
                  <ActivityIndicator size="small" />
                  <Text>{t('ai.generating')}</Text>
                </View>
              ) : (
                <Text>{t('ai.generatePacksButton')}</Text>
              )}
            </Button>
          </View>
        </View>
      </View>

      <View className="items-center justify-center p-8">
        <Text className="text-center text-muted-foreground mt-2">{t('ai.useFormAbove')}</Text>
      </View>

      <Alert title="" buttons={[]} ref={alertRef} />

      <Modal
        visible={packsModalVisible}
        animationType="slide"
        onRequestClose={() => setPacksModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <View className="flex-row items-center">
              <Text>{t('ai.generatedPacks')}</Text>
            </View>
            <TouchableOpacity onPress={() => setPacksModalVisible(false)}>
              <Icon name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 gap-2 px-4 py-6">
            {generatedPacksFromStore.every((pack) => !!pack) ? (
              generatedPacksFromStore.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onPress={(pack) => {
                    router.push({
                      pathname: '/pack/[id]',
                      params: { id: pack.id },
                    });
                  }}
                />
              ))
            ) : (
              <View className="flex-1 items-center justify-center p-8">
                <Text className="text-center text-muted-foreground mt-2">
                  {t('ai.waitingForSync')}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
