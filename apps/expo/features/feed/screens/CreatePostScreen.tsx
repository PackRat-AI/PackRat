import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { uploadImage } from 'expo-app/features/packs/utils/uploadImage';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as ImagePicker from 'expo-image-picker';
import { nanoid } from 'nanoid/non-secure';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCreatePost } from '../hooks';

interface SelectedPhoto {
  uri: string;
  fileName: string;
}

export const CreatePostScreen = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const { mutate: createPost, isPending } = useCreatePost();

  const pickImages = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('feed.permissionRequired'), t('feed.galleryPermission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: SelectedPhoto[] = result.assets.map((asset) => {
          const uriParts = asset.uri.split('/');
          const rawName = uriParts[uriParts.length - 1] ?? `photo_${Date.now()}.jpg`;
          return { uri: asset.uri, fileName: rawName };
        });
        setPhotos((prev) => [...prev, ...newPhotos].slice(0, 10));
      }
    } catch (err) {
      console.error('Error picking images:', err);
    }
  }, [t]);

  const takePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('feed.permissionRequired'), t('feed.cameraPermission'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset) {
          setPhotos((prev) =>
            [...prev, { uri: asset.uri, fileName: `camera_${Date.now()}.jpg` }].slice(0, 10),
          );
        }
      }
    } catch (err) {
      console.error('Error taking photo:', err);
    }
  }, [t]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (photos.length === 0) {
      Alert.alert(t('feed.noPhotos'), t('feed.addAtLeastOnePhoto'));
      return;
    }

    setUploading(true);
    const uploadedKeys: string[] = [];
    try {
      const results = await Promise.all(
        photos.map(async (photo) => {
          const ext = photo.fileName.includes('.')
            ? (photo.fileName.split('.').pop()?.toLowerCase() ?? 'jpg')
            : 'jpg';
          const uniqueName = `${nanoid()}.${ext}`;
          return uploadImage(uniqueName, photo.uri);
        }),
      );

      for (const key of results) {
        if (key) uploadedKeys.push(key);
      }

      if (uploadedKeys.length === 0) {
        throw new Error('No images uploaded');
      }

      createPost(
        { caption: caption.trim() || undefined, images: uploadedKeys },
        {
          onSuccess: () => {
            setPhotos([]);
            setCaption('');
            onSuccess?.();
          },
          onError: (err) => {
            console.error('Failed to create post:', err);
            Alert.alert(t('common.error'), t('feed.postFailed'));
          },
        },
      );
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert(t('common.error'), t('feed.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }, [photos, caption, createPost, t, onSuccess]);

  const isSubmitting = uploading || isPending;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      {/* Photo grid */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        {photos.map((photo, idx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: photos have no stable id
          <View key={`${photo.uri}-${idx}`} className="relative">
            <Image
              source={{ uri: photo.uri }}
              className="w-24 h-24 rounded-xl"
              resizeMode="cover"
            />
            <TouchableOpacity
              className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
              onPress={() => removePhoto(idx)}
            >
              <Icon name="close" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {photos.length < 10 && (
          <View className="flex-row gap-2">
            <Pressable
              onPress={pickImages}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-border items-center justify-center"
            >
              <Icon name="image-multiple" size={28} color={colors.grey2} />
              <Text className="text-xs text-muted-foreground mt-1">{t('feed.gallery')}</Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-border items-center justify-center"
            >
              <Icon name="camera" size={28} color={colors.grey2} />
              <Text className="text-xs text-muted-foreground mt-1">{t('feed.camera')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Caption input */}
      <View className="rounded-xl border border-border bg-card p-3 mb-6">
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t('feed.captionPlaceholder')}
          placeholderTextColor={colors.grey2}
          multiline
          numberOfLines={4}
          maxLength={2000}
          className="text-foreground text-sm min-h-[80px]"
          style={{ color: colors.foreground }}
        />
        <Text className="text-xs text-muted-foreground text-right mt-1">{caption.length}/2000</Text>
      </View>

      {/* Submit */}
      <Button
        onPress={handleSubmit}
        disabled={isSubmitting || photos.length === 0}
        variant="primary"
        className="w-full"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className="font-semibold">{t('feed.post')}</Text>
        )}
      </Button>
    </ScrollView>
  );
};
