import { ActivityIndicator, Text, TextField } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import * as Burnt from 'burnt';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGenerateTemplateFromTikTok } from '../hooks';

interface TikTokImportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TikTokImportModal({ visible, onClose }: TikTokImportModalProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const [tiktokUrl, setTiktokUrl] = useState('');

  const { mutate: generateTemplate, isPending } = useGenerateTemplateFromTikTok();

  const handleGenerate = () => {
    if (!tiktokUrl.trim()) {
      Burnt.toast({
        title: t('packTemplates.tiktokUrlRequired'),
        preset: 'error',
      });
      return;
    }

    generateTemplate(
      {
        tiktokUrl: tiktokUrl.trim(),
        isAppTemplate: true,
      },
      {
        onSuccess: (template) => {
          onClose();
          Burnt.toast({
            title: t('packTemplates.tiktokImportSuccess'),
            preset: 'done',
          });
          router.push({
            pathname: '/pack-templates/[id]',
            params: { id: template.id },
          });
        },
        onError: (error) => {
          console.error('TikTok import error:', error);

          // Handle duplicate template case - navigate to existing template
          if (error.code === 'DUPLICATE_TEMPLATE' && error.existingTemplateId) {
            onClose();
            Burnt.toast({
              title: t('packTemplates.templateAlreadyExists'),
              preset: 'none',
            });
            router.push({
              pathname: '/pack-templates/[id]',
              params: { id: error.existingTemplateId },
            });
            return;
          }

          // Handle other errors
          const errorMessage = error.message || t('packTemplates.tiktokImportError');
          Burnt.toast({
            title: t('packTemplates.importFailed'),
            message: errorMessage,
            preset: 'error',
          });
        },
      },
    );
  };

  const handleClose = () => {
    setTiktokUrl('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-background">
              <TouchableOpacity onPress={handleClose} className="p-2 -ml-2">
                <Icon name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-foreground">
                {t('packTemplates.importFromTikTok')}
              </Text>
              <View className="w-8" />
            </View>

            {/* Content */}
            <View className="flex-1 px-4 py-6">
              <View className="mb-6">
                <Text className="text-base text-muted-foreground leading-6 mb-4">
                  {t('packTemplates.tiktokImportDescription')}
                </Text>
              </View>

              {/* TikTok URL Input */}
              <View className="mb-6">
                <Text className="mb-3 text-sm font-medium text-foreground">
                  {t('packTemplates.tiktokUrl')}
                </Text>
                <TextField
                  placeholder={t('packTemplates.tiktokUrlPlaceholder')}
                  value={tiktokUrl}
                  onChangeText={setTiktokUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="link" size={16} color={colors.grey3} />
                    </View>
                  }
                />
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                onPress={handleGenerate}
                disabled={isPending}
                className={`rounded-lg px-4 py-4 flex-row items-center justify-center gap-2 ${isPending ? 'bg-primary/70' : 'bg-primary'}`}
              >
                {isPending && <ActivityIndicator size="small" color="white" />}
                <Text className="text-base font-semibold text-white">
                  {isPending
                    ? t('packTemplates.generatingFromTikTok')
                    : t('packTemplates.generateFromTikTok')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
