import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { FeedDialogHeader } from '../components/FeedDialogHeader';
import { MentionSuggestionList } from '../components/MentionSuggestionList';
import { useMentionSuggester } from '../hooks/useMentionSuggester';
import { useUpdateCaption } from '../hooks/usePostMutations';
import type { Post } from '../types';
import { feedErrorMessage } from '../utils/errorCopy';
import { MAX_CAPTION } from './CreatePostScreen';

/** Edits a post's caption and who it tags. Photos are fixed once posted. */
export function EditCaptionScreen({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const alertRef = useRef<AlertMethods>(null);
  const [caption, setCaption] = useState(post.caption ?? '');
  const mentions = useMentionSuggester({ text: caption, known: post.tags ?? [] });
  const update = useUpdateCaption();

  const trimmed = caption.trim();
  const unchanged = trimmed === (post.caption ?? '').trim();
  // A post with no photos still needs its text.
  const canSave =
    !unchanged && caption.length <= MAX_CAPTION && (post.images.length > 0 || trimmed.length > 0);

  const save = () =>
    update.mutate(
      { postId: post.id, caption: trimmed || null, taggedUserIds: mentions.taggedIds },
      {
        onSuccess: () => router.back(),
        onError: (error) =>
          alertRef.current?.alert({
            title: t('feed.captionSaveFailedTitle'),
            message: feedErrorMessage(error, t('feed.captionSaveFailed')),
            buttons: [{ text: t('feed.ok') }],
          }),
      },
    );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <FeedDialogHeader
        title={t('feed.editCaption')}
        actionLabel={t('feed.save')}
        onClose={() => router.back()}
        onAction={save}
        canAct={canSave}
        isBusy={update.isPending}
        closeTestID={testIds.feed.editCaptionCancel}
        actionTestID={testIds.feed.editCaptionSave}
      />
      <KeyboardAwareScrollView
        contentContainerClassName="gap-2 px-4 pt-2 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          autoFocus
          editable={!update.isPending}
          placeholder={t('feed.captionPlaceholder')}
          placeholderTextColor={colors.grey}
          className="min-h-[140px] text-base"
          style={{ color: colors.foreground, textAlignVertical: 'top' }}
          testID={testIds.feed.editCaptionInput}
        />
        <View className="flex-row justify-between">
          <Text variant="caption1" className="text-muted-foreground">
            {post.images.length > 0 ? t('feed.photosFixed') : ''}
          </Text>
          <Text
            variant="caption1"
            style={{ color: caption.length > MAX_CAPTION ? colors.destructive : colors.grey }}
          >
            {`${caption.length} / ${MAX_CAPTION}`}
          </Text>
        </View>
        <MentionSuggestionList
          suggestions={mentions.suggestions}
          onSelect={(person) => setCaption(mentions.accept(person))}
        />
      </KeyboardAwareScrollView>
      <Alert ref={alertRef} title="" buttons={[]} />
    </View>
  );
}
