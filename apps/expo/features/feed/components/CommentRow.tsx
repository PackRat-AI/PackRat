import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import { Pressable, View } from 'react-native';
import type { Comment, PostAuthor } from '../types';
import { displayName } from '../utils/mentions';
import { MentionText } from './MentionText';
import { PersonAvatar } from './PersonAvatar';

export type CommentAction = 'reply' | 'edit' | 'delete' | 'report' | 'block';

/**
 * One comment: who wrote it and when, its text, a like, Reply, and an overflow menu. The
 * commenter can edit or delete; the post's author can delete any comment on it; anyone else can
 * report it or block the commenter.
 */
export function CommentRow({
  comment,
  isReply,
  isPostAuthor,
  myId,
  viewerOwnsPost,
  taggedPeople,
  onLike,
  onAction,
}: {
  comment: Comment;
  isReply: boolean;
  isPostAuthor: boolean;
  myId: string | undefined;
  viewerOwnsPost: boolean;
  taggedPeople: PostAuthor[];
  onLike: (comment: Comment) => void;
  onAction: (comment: Comment, action: CommentAction) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const isMine = comment.userId === myId;
  const name = comment.author ? displayName(comment.author) : t('feed.unknownPerson');

  const items = [
    createDropdownItem({ actionKey: 'reply', title: t('feed.reply'), icon: { name: 'reply' } }),
    ...(isMine
      ? [
          createDropdownItem({
            actionKey: 'edit',
            title: t('feed.edit'),
            icon: { name: 'pencil-outline' },
          }),
        ]
      : []),
    ...(isMine || viewerOwnsPost
      ? [
          createDropdownItem({
            actionKey: 'delete',
            title: t('feed.delete'),
            icon: { name: 'trash-can-outline' },
            destructive: true,
          }),
        ]
      : []),
    ...(isMine
      ? []
      : [
          createDropdownItem({
            actionKey: 'report',
            title: t('feed.reportComment'),
            icon: { name: 'flag-outline' },
          }),
          ...(comment.author
            ? [
                createDropdownItem({
                  actionKey: 'block',
                  title: t('feed.blockPerson', { name }),
                  icon: { name: 'cancel' },
                  destructive: true,
                }),
              ]
            : []),
        ]),
  ];

  return (
    <View
      className={`flex-row gap-3 ${isReply ? 'pl-[52px]' : ''}`}
      testID={testIds.feed.comment(comment.id)}
    >
      <View className="pt-1">
        <PersonAvatar person={comment.author} size={isReply ? 28 : 32} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <View className="flex-1 flex-row flex-wrap items-center gap-x-1.5">
            <Text variant="subhead" className="font-semibold">
              {name}
            </Text>
            {isPostAuthor ? (
              <View className="rounded-full bg-primary/15 px-2 py-0.5">
                <Text variant="caption2" className="font-semibold text-primary">
                  {t('feed.author')}
                </Text>
              </View>
            ) : null}
            <Text variant="caption1" className="text-muted-foreground">
              {getRelativeTime({ dateValue: comment.createdAt })}
            </Text>
          </View>
          <DropdownMenu
            items={items}
            onItemPress={({ actionKey }) => onAction(comment, actionKey as CommentAction)}
            testID={testIds.feed.commentMenu(comment.id)}
          >
            <View
              accessibilityRole="button"
              accessibilityLabel={t('feed.more')}
              className="-my-2 h-10 w-10 items-center justify-center"
            >
              <Icon name="dots-vertical" size={20} color={colors.grey} />
            </View>
          </DropdownMenu>
        </View>
        <MentionText text={comment.content} people={taggedPeople} variant="subhead" selectable />
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => onAction(comment, 'reply')}
            className="min-h-[40px] justify-center pr-3"
            accessibilityRole="button"
            testID={testIds.feed.commentReply(comment.id)}
          >
            <Text variant="footnote" className="font-semibold text-muted-foreground">
              {t('feed.reply')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onLike(comment)}
            className="min-h-[40px] flex-row items-center gap-1 px-2"
            accessibilityRole="button"
            accessibilityLabel={comment.likedByMe ? t('feed.unlikeComment') : t('feed.likeComment')}
            android_ripple={{ color: colors.grey5, borderless: true }}
            testID={testIds.feed.commentLike(comment.id)}
          >
            <Icon
              name={comment.likedByMe ? 'heart' : 'heart-outline'}
              size={16}
              color={comment.likedByMe ? colors.destructive : colors.grey}
            />
            {comment.likeCount > 0 ? (
              <Text variant="footnote" className="text-muted-foreground">
                {comment.likeCount}
              </Text>
            ) : null}
          </Pressable>
          {comment.editedAt ? (
            <Text variant="footnote" className="pl-2 text-muted-foreground">
              {t('feed.edited')}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
