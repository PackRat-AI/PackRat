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
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { useGeneratePacks } from '../hooks/useGeneratedPacks';

export function AIPacksScreen() {
  const { colors } = useColorScheme();
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
          title: 'Packs Generated',
          message: `Successfully generated ${packs.length} packs.`,
          materialIcon: { name: 'backpack', color: colors.green },
          buttons: [
            { text: 'Return', onPress: () => {} },
            {
              text: 'View',
              onPress: () => {
                setPacksModalVisible(true);
              },
            },
          ],
        });
      } catch (error) {
        alertRef.current?.alert({
          title: 'Error',
          message: 'Failed to generate packs. Please try again.',
          materialIcon: { name: 'exclamation', color: colors.destructive },
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        console.error('Error generating packs:', error);
      }
    },
  });

  const handleGeneratePacks = () => {
    alertRef.current?.alert({
      title: 'Generate Packs',
      message: `Are you sure you want to generate ${form.getFieldValue('count')} packs?`,
      materialIcon: { name: 'information-outline', color: colors.primary },
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => form.handleSubmit(),
          style: 'default',
        },
      ],
    });
  };

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader title="AI Packs Admin" backVisible={true} />

      <View className="px-4 py-6 space-y-6">
        {/* Generation Form */}
        <View className="bg-card p-4 rounded-xl">
          <Text className="text-lg font-semibold mb-4">Generate New Packs</Text>

          <form.Field name="count">
            {(field) => (
              <View className="space-y-2">
                <TextInput
                  className="border border-border rounded-lg px-3 py-2 text-foreground bg-background"
                  value={field.state.value.toString()}
                  onChangeText={(text) => field.handleChange(Number.parseInt(text) || 1)}
                  keyboardType="numeric"
                  placeholder="Enter count"
                />
                <Text variant="caption2">Number of packs to generate</Text>
              </View>
            )}
          </form.Field>

          <View className="mt-4">
            <Button onPress={handleGeneratePacks} disabled={isPending} className="w-full">
              {isPending ? (
                <View className="flex-row items-center space-x-2">
                  <ActivityIndicator size="small" />
                  <Text>Generating...</Text>
                </View>
              ) : (
                <Text>Generate Packs</Text>
              )}
            </Button>
          </View>
        </View>
      </View>

      <View className="items-center justify-center p-8">
        <Text className="text-center text-muted-foreground mt-2">
          Use the form above to generate packs with AI
        </Text>
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
              <Text>Generated Packs</Text>
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
                  Waiting for packs to sync.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
