import { ActivityIndicator, Text, TextField } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useGenerateTemplateFromTikTok } from '../hooks';

interface ImageUrlEntry {
  id: string;
  url: string;
}

let _idCounter = 0;
const makeId = () => {
  _idCounter += 1;
  return `img-${_idCounter}`;
};

export function TikTokImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [imageEntries, setImageEntries] = useState<ImageUrlEntry[]>([{ id: makeId(), url: '' }]);

  const { mutate: generateTemplate, isPending } = useGenerateTemplateFromTikTok();

  const handleAddImageUrl = useCallback(() => {
    setImageEntries((prev) => [...prev, { id: makeId(), url: '' }]);
  }, []);

  const handleRemoveImageUrl = useCallback((id: string) => {
    setImageEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleImageUrlChange = useCallback((id: string, value: string) => {
    setImageEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, url: value } : entry)),
    );
  }, []);

  const handleGenerate = () => {
    const validImageUrls = imageEntries.map((e) => e.url.trim()).filter((url) => url.length > 0);

    if (!tiktokUrl.trim()) {
      Toast.show({
        type: 'error',
        text1: t('packTemplates.tiktokUrlRequired'),
      });
      return;
    }

    if (validImageUrls.length === 0) {
      Toast.show({
        type: 'error',
        text1: t('packTemplates.tiktokImageUrlsRequired'),
      });
      return;
    }

    generateTemplate(
      {
        tiktokUrl: tiktokUrl.trim(),
        imageUrls: validImageUrls,
        caption: caption.trim() || undefined,
        isAppTemplate: true,
      },
      {
        onSuccess: (template) => {
          Toast.show({
            type: 'success',
            text1: t('packTemplates.tiktokImportSuccess'),
          });
          router.replace({
            pathname: '/pack-templates/[id]',
            params: { id: template.id },
          });
        },
        onError: (error) => {
          console.error('TikTok import error:', error);
          Toast.show({
            type: 'error',
            text1: t('packTemplates.tiktokImportError'),
          });
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('packTemplates.importFromTikTok'),
          headerBackVisible: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-background" contentContainerClassName="p-6">
          {/* Description */}
          <View className="mb-6 rounded-xl bg-card p-4 border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Icon name="information" size={18} color={colors.primary} />
              <Text className="font-semibold text-foreground">
                {t('packTemplates.importFromTikTok')}
              </Text>
            </View>
            <Text className="text-sm text-muted-foreground leading-5">
              {t('packTemplates.tiktokImportDescription')}
            </Text>
          </View>

          {/* TikTok URL */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-foreground">
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

          {/* Caption (optional) */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-foreground">
              Caption / Description{' '}
              <Text className="text-muted-foreground font-normal">(optional)</Text>
            </Text>
            <TextField
              placeholder="e.g. My ultralight PCT kit 35L"
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              leftView={
                <View className="ios:pl-2 justify-center pl-2">
                  <Icon name="text" size={16} color={colors.grey3} />
                </View>
              }
            />
          </View>

          {/* Slideshow Image URLs */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-foreground">Slideshow Image URLs</Text>
              <TouchableOpacity onPress={handleAddImageUrl} className="flex-row items-center gap-1">
                <Icon name="plus-circle" size={16} color={colors.primary} />
                <Text className="text-sm text-primary">Add URL</Text>
              </TouchableOpacity>
            </View>
            {imageEntries.map((entry, index) => (
              <View key={entry.id} className="flex-row items-center gap-2 mb-2">
                <View className="flex-1">
                  <TextField
                    placeholder={`Image URL ${index + 1}`}
                    value={entry.url}
                    onChangeText={(value) => handleImageUrlChange(entry.id, value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
                        <Icon name="image" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </View>
                {imageEntries.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveImageUrl(entry.id)} className="p-2">
                    <Icon name="close-circle" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Generate Button */}
          <Pressable
            onPress={handleGenerate}
            disabled={isPending}
            className={`rounded-xl px-4 py-4 flex-row items-center justify-center gap-2 ${
              isPending ? 'bg-primary/70' : 'bg-primary'
            }`}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Icon name="import" size={20} color="white" />
            )}
            <Text className="text-base font-semibold text-primary-foreground">
              {isPending
                ? t('packTemplates.generatingFromTikTok')
                : t('packTemplates.generateFromTikTok')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
