import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { MAX_REPORT_PHOTOS } from '../hooks/useTrailConditionForm';

/** Longest edge a report photo keeps: sharp on a phone, light on a slow trailhead connection. */
const MAX_PHOTO_EDGE = 2048;

/**
 * Re-encodes a picked photo as a fresh JPEG. The encoder writes no metadata, so the GPS position
 * the camera stamped is gone before the photo leaves the device.
 */
async function strippedCopy(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const longest = Math.max(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_PHOTO_EDGE) {
    context.resize(
      asset.width >= asset.height ? { width: MAX_PHOTO_EDGE } : { height: MAX_PHOTO_EDGE },
    );
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}

interface ReportPhotoPickerProps {
  photoUris: string[];
  onAdd: (uris: string[]) => void;
  onRemove: (uri: string) => void;
  isLocked: boolean;
}

/** The Photos section of the submit form — `ReportPhotoPickerSection` in `ReportPhotos.swift`. */
export function ReportPhotoPicker({
  photoUris,
  onAdd,
  onRemove,
  isLocked,
}: ReportPhotoPickerProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [isPreparing, setIsPreparing] = useState(false);
  const remaining = MAX_REPORT_PHOTOS - photoUris.length;

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;
      setIsPreparing(true);
      onAdd(await Promise.all(result.assets.slice(0, remaining).map(strippedCopy)));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'trailConditions', action: 'pickReportPhotos' },
      });
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
          {t('trailConditions.photos')}
        </Text>
        <Text variant="caption1" className="text-muted-foreground">
          {t('trailConditions.photoCount', { count: photoUris.length, max: MAX_REPORT_PHOTOS })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3"
      >
        {photoUris.map((uri, index) => (
          <View key={uri} className="h-20 w-20 overflow-hidden rounded-xl bg-muted">
            <Image source={{ uri }} className="h-full w-full" accessibilityIgnoresInvertColors />
            {isLocked ? null : (
              <Pressable
                onPress={() => onRemove(uri)}
                testID={testIds.trailConditions.removePhotoBtn(index)}
                accessibilityRole="button"
                accessibilityLabel={t('trailConditions.removePhoto')}
                hitSlop={8}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5"
              >
                <Icon name="close" size={16} color="white" />
              </Pressable>
            )}
          </View>
        ))}
        {remaining > 0 && !isLocked ? (
          <Pressable
            onPress={pick}
            disabled={isPreparing}
            testID={testIds.trailConditions.addPhotosBtn}
            accessibilityRole="button"
            accessibilityLabel={t('trailConditions.addPhoto')}
            className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-border bg-card active:opacity-80"
          >
            <Icon name="camera-plus-outline" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
      </ScrollView>
      <Text variant="caption1" className="text-muted-foreground" wrap>
        {t('trailConditions.photosHint')}
      </Text>
    </View>
  );
}
