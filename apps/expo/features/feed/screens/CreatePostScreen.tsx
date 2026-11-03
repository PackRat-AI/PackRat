import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { userStore } from 'expo-app/features/auth/store';
import { uploadImage } from 'expo-app/features/packs/utils/uploadImage';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { nanoid } from 'nanoid';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { FeedDialogHeader } from '../components/FeedDialogHeader';
import { MentionSuggestionList } from '../components/MentionSuggestionList';
import { PersonAvatar } from '../components/PersonAvatar';
import { useMentionSuggester } from '../hooks/useMentionSuggester';
import { useCreatePost } from '../hooks/usePostMutations';
import { feedErrorMessage } from '../utils/errorCopy';
import { displayName } from '../utils/mentions';

export const MAX_POST_PHOTOS = 10;
export const MAX_CAPTION = 500;
/** Longest edge a posted photo keeps: sharp on a phone screen. */
const MAX_PHOTO_EDGE = 2048;

/** A photo waiting to be posted. Keeps its uploaded key so a retry only uploads what didn't make it. */
interface DraftPhoto {
  id: string;
  uri: string;
  uploadedKey?: string;
}

type Phase =
  | { kind: 'editing' }
  | { kind: 'uploading'; completed: number; total: number }
  | { kind: 'publishing' };

/**
 * Re-encodes a picked photo as a fresh JPEG at upload size. The encoder writes no metadata, so the
 * GPS position the camera stamped is gone before the photo leaves the device.
 */
async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_PHOTO_EDGE) {
    context.resize(
      asset.width >= asset.height ? { width: MAX_PHOTO_EDGE } : { height: MAX_PHOTO_EDGE },
    );
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

/** The New Post full-screen dialog: photos, a caption with `@` tagging, and Post. */
export function CreatePostScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const navigation = useNavigation();
  const alertRef = useRef<AlertMethods>(null);
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mentions = useMentionSuggester({ text: caption });
  const createPost = useCreatePost();

  const user = userStore.peek();
  const userId = user?.id != null ? String(user.id) : undefined;
  const me = {
    id: userId ?? '',
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
  };

  const trimmed = caption.trim();
  const isEditing = phase.kind === 'editing';
  const isBusy = !isEditing || isImporting;
  const hasContent = photos.length > 0 || trimmed.length > 0;
  const canPost = !isBusy && hasContent && caption.length <= MAX_CAPTION;
  const remaining = MAX_POST_PHOTOS - photos.length;

  usePreventRemove(hasContent && !done, ({ data }) => {
    if (!isEditing) return;
    alertRef.current?.alert({
      title: t('feed.discardTitle'),
      message: t('feed.discardBody'),
      buttons: [
        { text: t('feed.keepEditing'), style: 'cancel' },
        {
          text: t('feed.discard'),
          style: 'destructive',
          onPress: () => {
            setDone(true);
            navigation.dispatch(data.action);
          },
        },
      ],
    });
  });

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setIsImporting(true);
    try {
      for (const asset of assets.slice(0, remaining)) {
        try {
          const uri = await preparePhoto(asset);
          setPhotos((current) => [...current, { id: nanoid(), uri }].slice(0, MAX_POST_PHOTOS));
        } catch (err) {
          Sentry.captureException(err, { tags: { feature: 'feed', action: 'preparePhoto' } });
          setError(t('feed.photoUnreadable'));
        }
      }
    } finally {
      setIsImporting(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (!result.canceled) await addAssets(result.assets);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'feed', action: 'pickPhotos' } });
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        alertRef.current?.alert({
          title: t('feed.permissionRequired'),
          message: t('feed.cameraPermission'),
          buttons: [{ text: t('feed.ok') }],
        });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) await addAssets(result.assets);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'feed', action: 'takePhoto' } });
    }
  };

  const move = ({ id, by }: { id: string; by: number }) =>
    setPhotos((current) => {
      const from = current.findIndex((p) => p.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [photo] = next.splice(from, 1);
      if (photo) next.splice(to, 0, photo);
      return next;
    });

  const remove = (id: string) => setPhotos((current) => current.filter((p) => p.id !== id));

  const post = async () => {
    if (!canPost) return;
    if (!userId) {
      setError(t('feed.signInToPost'));
      return;
    }
    setError(null);
    let working = photos;
    try {
      const pending = working.filter((p) => !p.uploadedKey);
      let completed = working.length - pending.length;
      if (pending.length > 0) {
        setPhase({ kind: 'uploading', completed, total: working.length });
        Sentry.addBreadcrumb({
          category: 'feed',
          message: 'Uploading post photos',
          level: 'info',
          data: { count: pending.length },
        });
        await Promise.all(
          pending.map(async (photo) => {
            const key = await uploadImage({ fileName: `${nanoid()}.jpg`, uri: photo.uri });
            if (!key) throw new Error('Photo upload returned no key');
            working = working.map((p) => (p.id === photo.id ? { ...p, uploadedKey: key } : p));
            setPhotos((current) =>
              current.map((p) => (p.id === photo.id ? { ...p, uploadedKey: key } : p)),
            );
            completed += 1;
            setPhase({ kind: 'uploading', completed, total: working.length });
          }),
        );
      }
      setPhase({ kind: 'publishing' });
      await createPost.mutateAsync({
        caption: trimmed || undefined,
        images: working.flatMap((p) => (p.uploadedKey ? [p.uploadedKey] : [])),
        taggedUserIds: mentions.taggedIds,
      });
      setDone(true);
      requestAnimationFrame(() => router.back());
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'feed', action: 'createPost' },
        extra: { photoCount: working.length },
      });
      setPhase({ kind: 'editing' });
      setError(feedErrorMessage({ error: err, fallback: t('feed.postFailed') }));
    }
  };

  const counterColor =
    caption.length > MAX_CAPTION
      ? colors.destructive
      : caption.length > MAX_CAPTION - 50
        ? '#B45309'
        : colors.grey;

  return (
    <View className="flex-1 bg-background" testID={testIds.feed.composer}>
      <Stack.Screen options={{ headerShown: false }} />
      <FeedDialogHeader
        title={t('feed.newPost')}
        actionLabel={t('feed.post')}
        onClose={() => router.back()}
        onAction={post}
        canAct={canPost}
        isBusy={!isEditing}
        closeTestID={testIds.feed.composerCancel}
        actionTestID={testIds.feed.composerPost}
      />
      <KeyboardAwareScrollView
        contentContainerClassName="gap-5 px-4 pb-10 pt-2"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* Caption */}
        <View className="gap-1">
          <View className="flex-row gap-3">
            <PersonAvatar person={me} size={36} />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              editable={isEditing}
              multiline
              placeholder={t('feed.captionPlaceholder')}
              placeholderTextColor={colors.grey}
              className="min-h-[120px] flex-1 text-base"
              style={{ color: colors.foreground, textAlignVertical: 'top' }}
              testID={testIds.feed.composerCaption}
            />
          </View>
          <Text
            variant="caption1"
            className="self-end"
            style={{ color: counterColor, fontVariant: ['tabular-nums'] }}
            testID={testIds.feed.composerCounter}
          >
            {`${caption.length} / ${MAX_CAPTION}`}
          </Text>
          <MentionSuggestionList
            suggestions={mentions.suggestions}
            onSelect={(person) => setCaption(mentions.accept(person))}
          />
        </View>

        {/* Photos */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="subhead" className="font-medium">
              {t('feed.photos')}
            </Text>
            <Text
              variant="caption1"
              className="text-muted-foreground"
              testID={testIds.feed.composerPhotoCount}
            >
              {t('feed.photoCount', { count: photos.length, max: MAX_POST_PHOTOS })}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2.5"
          >
            {photos.map((photo, index) => (
              <View
                key={photo.id}
                className="h-[88px] w-[88px] overflow-hidden rounded-xl bg-muted"
                testID={testIds.feed.composerPhoto(index)}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: 88, height: 88 }}
                  contentFit="cover"
                />
                {index === 0 ? (
                  <View className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5">
                    <Text variant="caption2" className="font-semibold text-white">
                      {t('feed.cover')}
                    </Text>
                  </View>
                ) : null}
                {isEditing ? (
                  <>
                    <Pressable
                      onPress={() => remove(photo.id)}
                      hitSlop={8}
                      className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                      accessibilityRole="button"
                      accessibilityLabel={t('feed.removePhoto')}
                      testID={testIds.feed.composerRemovePhoto(index)}
                    >
                      <Icon name="close" size={14} color="white" />
                    </Pressable>
                    {index > 0 ? (
                      <Pressable
                        onPress={() => move({ id: photo.id, by: -1 })}
                        hitSlop={6}
                        className="absolute bottom-1 left-1 h-7 w-7 items-center justify-center rounded-full bg-black/60"
                        accessibilityRole="button"
                        accessibilityLabel={t('feed.moveEarlier')}
                        testID={testIds.feed.composerMoveEarlier(index)}
                      >
                        <Icon name="chevron-left" size={18} color="white" />
                      </Pressable>
                    ) : null}
                    {index < photos.length - 1 ? (
                      <Pressable
                        onPress={() => move({ id: photo.id, by: 1 })}
                        hitSlop={6}
                        className="absolute bottom-1 right-1 h-7 w-7 items-center justify-center rounded-full bg-black/60"
                        accessibilityRole="button"
                        accessibilityLabel={t('feed.moveLater')}
                        testID={testIds.feed.composerMoveLater(index)}
                      >
                        <Icon name="chevron-right" size={18} color="white" />
                      </Pressable>
                    ) : null}
                  </>
                ) : photo.uploadedKey ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/20">
                    <Icon name="check-circle" size={28} color="#22c55e" />
                  </View>
                ) : null}
              </View>
            ))}
            {isImporting ? (
              <View className="h-[88px] w-[88px] items-center justify-center rounded-xl border border-border bg-card">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
            {remaining > 0 && isEditing ? (
              <>
                <Pressable
                  onPress={pickFromLibrary}
                  disabled={isImporting}
                  className="h-[88px] w-[88px] items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card"
                  accessibilityRole="button"
                  android_ripple={{ color: colors.grey5 }}
                  testID={testIds.feed.composerLibrary}
                >
                  <Icon name="image-multiple-outline" size={24} color={colors.primary} />
                  <Text variant="caption1">{t('feed.library')}</Text>
                </Pressable>
                <Pressable
                  onPress={takePhoto}
                  disabled={isImporting}
                  className="h-[88px] w-[88px] items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card"
                  accessibilityRole="button"
                  android_ripple={{ color: colors.grey5 }}
                  testID={testIds.feed.composerCamera}
                >
                  <Icon name="camera-outline" size={24} color={colors.primary} />
                  <Text variant="caption1">{t('feed.camera')}</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
          <Text variant="footnote" className="text-muted-foreground" wrap>
            {photos.length > 1
              ? t('feed.photosHintMany')
              : t('feed.photosHintOne', { max: MAX_POST_PHOTOS })}
          </Text>
        </View>

        {/* Tagged */}
        {mentions.taggedPeople.length > 0 ? (
          <View className="gap-2">
            <Text variant="subhead" className="font-medium">
              {t('feed.tagging')}
            </Text>
            <View className="rounded-xl border border-border bg-card">
              {mentions.taggedPeople.map((person, index) => (
                <View
                  key={person.id}
                  className={`min-h-[48px] flex-row items-center gap-3 px-4 py-2${
                    index > 0 ? ' border-t border-border' : ''
                  }`}
                  testID={testIds.feed.composerTagged(person.id)}
                >
                  <PersonAvatar person={person} size={28} />
                  <Text>{displayName(person) || t('feed.packratMember')}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Status */}
        {phase.kind === 'uploading' ? (
          <View className="gap-2" testID={testIds.feed.composerProgress}>
            <Text variant="callout">
              {t('feed.uploading', {
                index: Math.min(phase.completed + 1, phase.total),
                count: phase.total,
              })}
            </Text>
            <View className="h-1 overflow-hidden rounded-full bg-border">
              <View
                className="h-1 bg-primary"
                style={{ width: `${(phase.completed / Math.max(phase.total, 1)) * 100}%` }}
              />
            </View>
          </View>
        ) : phase.kind === 'publishing' ? (
          <View className="flex-row items-center gap-2.5">
            <ActivityIndicator color={colors.primary} />
            <Text variant="callout">{t('feed.posting')}</Text>
          </View>
        ) : error ? (
          <View
            className="gap-3 rounded-xl border border-border bg-card p-4"
            testID={testIds.feed.composerError}
          >
            <View className="flex-row gap-3">
              <Icon name="alert-circle-outline" size={20} color={colors.destructive} />
              <Text variant="callout" className="flex-1" wrap>
                {error}
              </Text>
            </View>
            {hasContent ? (
              <Pressable
                onPress={post}
                disabled={!canPost}
                className="h-10 flex-row items-center gap-2 self-start rounded-full border border-border px-4"
                accessibilityRole="button"
                android_ripple={{ color: colors.grey5 }}
                testID={testIds.feed.composerRetry}
              >
                <Icon name="refresh" size={18} color={colors.primary} />
                <Text variant="callout" className="font-medium text-primary">
                  {t('feed.tryAgain')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
      <Alert ref={alertRef} title="" buttons={[]} />
    </View>
  );
}
