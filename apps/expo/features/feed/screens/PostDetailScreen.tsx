import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, type TextInputInstance, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type CommentAction, CommentRow } from '../components/CommentRow';
import { MentionSuggestionList } from '../components/MentionSuggestionList';
import { PostCard } from '../components/PostCard';
import { ReportReasonDialog } from '../components/ReportReasonDialog';
import { usePostActions } from '../components/usePostActions';
import { useCommentMutations, usePostComments } from '../hooks/useComments';
import { useLiveComments } from '../hooks/useLiveComments';
import { useMentionSuggester } from '../hooks/useMentionSuggester';
import type { Comment, Post } from '../types';
import { commentThreads, replyParentId } from '../utils/commentThreads';
import { feedErrorMessage } from '../utils/errorCopy';
import { displayName } from '../utils/mentions';

const MAX_COMMENT = 1000;

type Row =
  | { kind: 'comment'; comment: Comment; isReply: boolean }
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'error' };

/**
 * A post with its comment thread underneath. Comments thread one level deep, update live while
 * the screen is open, and are written from the bar at the bottom — which also handles replying and
 * editing.
 */
export function PostDetailScreen({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const alertRef = useRef<AlertMethods>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const listRef = useRef<FlatList<Row>>(null);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
  const actions = usePostActions({ onGone: leave });
  const comments = usePostComments(post.id);
  const write = useCommentMutations(post.id);
  useLiveComments(post.id);

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);
  const tags = post.tags ?? [];
  const mentions = useMentionSuggester({ text: draft, known: tags });
  const viewerOwnsPost = post.userId === actions.myId;

  const tell = ({ title, error, fallback }: { title: string; error: unknown; fallback?: string }) =>
    alertRef.current?.alert({
      title,
      message: feedErrorMessage({
        error: error,
        fallback: fallback ?? t('feed.somethingWentWrong'),
      }),
      buttons: [{ text: t('feed.ok') }],
    });

  const rows = useMemo<Row[]>(() => {
    if (comments.isLoading) return [{ kind: 'loading' }];
    if (comments.isError && !comments.data) return [{ kind: 'error' }];
    const threads = commentThreads(comments.data ?? []);
    if (threads.length === 0) return [{ kind: 'empty' }];
    return threads.flatMap((thread) => [
      { kind: 'comment' as const, comment: thread.root, isReply: false },
      ...thread.replies.map((reply) => ({
        kind: 'comment' as const,
        comment: reply,
        isReply: true,
      })),
    ]);
  }, [comments.isLoading, comments.isError, comments.data]);

  const clearComposer = () => {
    setDraft('');
    setReplyingTo(null);
    setEditing(null);
    mentions.reset(tags);
  };

  const send = () => {
    const content = draft.trim();
    if (!content || content.length > MAX_COMMENT) return;
    if (editing) {
      write.edit.mutate(
        { commentId: editing.id, content, taggedUserIds: mentions.taggedIds },
        {
          onSuccess: clearComposer,
          onError: (error) => tell({ title: t('feed.commentSaveFailed'), error }),
        },
      );
      return;
    }
    write.add.mutate(
      {
        content,
        taggedUserIds: mentions.taggedIds,
        ...(replyingTo ? { parentCommentId: replyParentId(replyingTo) } : {}),
      },
      {
        onSuccess: () => {
          clearComposer();
          inputRef.current?.blur();
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        },
        onError: (error) => tell({ title: t('feed.commentFailed'), error }),
      },
    );
  };

  const onAction = ({ comment, action }: { comment: Comment; action: CommentAction }) => {
    if (action === 'reply') {
      setEditing(null);
      setReplyingTo(comment);
      inputRef.current?.focus();
    } else if (action === 'edit') {
      setReplyingTo(null);
      setEditing(comment);
      setDraft(comment.content);
      inputRef.current?.focus();
    } else if (action === 'delete') {
      alertRef.current?.alert({
        title: t('feed.deleteCommentTitle'),
        message: t('feed.deleteCommentBody'),
        buttons: [
          { text: t('feed.cancel'), style: 'cancel' },
          {
            text: t('feed.delete'),
            style: 'destructive',
            onPress: () =>
              write.remove.mutate(comment, {
                onError: (error) => tell({ title: t('feed.commentDeleteFailed'), error }),
              }),
          },
        ],
      });
    } else if (action === 'report') {
      setReporting(comment);
    } else if (action === 'block' && comment.author) {
      actions.confirmBlock({ person: comment.author, onBlocked: () => comments.refetch() });
    }
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'loading') {
      return (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      );
    }
    if (item.kind === 'error') {
      return (
        <View className="items-center gap-3 py-10">
          <Text className="text-muted-foreground">{t('feed.commentsLoadFailed')}</Text>
          <Pressable
            onPress={() => comments.refetch()}
            className="h-10 justify-center rounded-full border border-border px-4"
            accessibilityRole="button"
          >
            <Text variant="callout" className="font-medium text-primary">
              {t('feed.tryAgain')}
            </Text>
          </Pressable>
        </View>
      );
    }
    if (item.kind === 'empty') {
      return (
        <View className="items-center gap-1 py-10" testID={testIds.feed.commentsEmpty}>
          <Icon name="comment-multiple-outline" size={40} color={colors.grey} />
          <Text className="font-medium">{t('feed.noComments')}</Text>
          <Text variant="footnote" className="text-muted-foreground">
            {t('feed.noCommentsBody')}
          </Text>
        </View>
      );
    }
    return (
      <CommentRow
        comment={item.comment}
        isReply={item.isReply}
        isPostAuthor={item.comment.userId === post.userId}
        myId={actions.myId}
        viewerOwnsPost={viewerOwnsPost}
        taggedPeople={tags}
        onLike={(comment) =>
          write.like.mutate(comment, {
            onError: (error) => tell({ title: t('feed.likeFailed'), error }),
          })
        }
        onAction={onAction}
      />
    );
  };

  const composerHint = editing
    ? t('feed.editingComment')
    : replyingTo
      ? t('feed.replyingTo', {
          name: replyingTo.author ? displayName(replyingTo.author) : t('feed.aComment'),
        })
      : null;
  const placeholder = replyingTo
    ? t('feed.replyTo', {
        name: replyingTo.author ? displayName(replyingTo.author) : t('feed.aComment'),
      })
    : t('feed.addComment');
  const isSending = write.add.isPending || write.edit.isPending;
  const canSend = draft.trim().length > 0 && draft.length <= MAX_COMMENT && !isSending;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('feed.postTitle') }} />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(row) => (row.kind === 'comment' ? String(row.comment.id) : row.kind)}
          renderItem={renderRow}
          ListHeaderComponent={
            <View className="gap-4 pb-4">
              <PostCard
                post={post}
                actions={actions}
                onOpenComments={() => inputRef.current?.focus()}
                showCommentsLink={false}
              />
              <Text variant="subhead" className="px-1 font-semibold">
                {t('feed.comments')}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          testID={testIds.feed.postDetail(post.id)}
        />
      </KeyboardAvoidingView>

      {/* Rides on top of the keyboard, the same way the PackRat AI composer does. */}
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View
          className="gap-2 border-t border-border bg-background px-3 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <MentionSuggestionList
            suggestions={mentions.suggestions}
            onSelect={(person) => setDraft(mentions.accept(person))}
          />
          {composerHint ? (
            <View className="flex-row items-center gap-2 pl-2">
              <Text variant="footnote" className="flex-1 text-muted-foreground" numberOfLines={1}>
                {composerHint}
              </Text>
              <Pressable
                onPress={clearComposer}
                className="h-8 w-8 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={t('feed.cancel')}
                testID={testIds.feed.commentCancel}
              >
                <Icon name="close" size={18} color={colors.grey} />
              </Pressable>
            </View>
          ) : null}
          <View className="flex-row items-end gap-2">
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={colors.grey}
              multiline
              maxLength={MAX_COMMENT}
              className="max-h-32 min-h-[40px] flex-1 rounded-3xl border border-border bg-card px-4 py-2 text-base"
              style={{ color: colors.foreground }}
              testID={testIds.feed.commentInput}
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: canSend ? colors.primary : colors.grey5 }}
              accessibilityRole="button"
              accessibilityLabel={editing ? t('feed.save') : t('feed.send')}
              testID={testIds.feed.commentSend}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Icon
                  name={editing ? 'check' : 'send'}
                  size={18}
                  color={canSend ? colors.primaryForeground : colors.grey}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardStickyView>

      {actions.dialogs}
      <Alert ref={alertRef} title="" buttons={[]} />
      <ReportReasonDialog
        title={t('feed.reportComment')}
        visible={reporting !== null}
        onDismiss={() => setReporting(null)}
        onReport={(reason) => {
          const comment = reporting;
          setReporting(null);
          if (!comment) return;
          write.report.mutate(
            { comment, reason },
            {
              onSuccess: () =>
                alertRef.current?.alert({
                  title: t('feed.reportedTitle'),
                  message: t('feed.reportedBody'),
                  buttons: [{ text: t('feed.ok') }],
                }),
              onError: (error) => tell({ title: t('feed.reportFailed'), error }),
            },
          );
        }}
      />
    </View>
  );
}
