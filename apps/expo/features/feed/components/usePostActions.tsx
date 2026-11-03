import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { createDropdownItem } from '@packrat/ui/src/dropdown-menu';
import { userStore } from 'expo-app/features/auth/store';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  useBlockUser,
  useDeletePost,
  useRemoveMyTag,
  useReportPost,
} from '../hooks/usePostMutations';
import type { Post, PostAuthor } from '../types';
import { feedErrorMessage } from '../utils/errorCopy';
import { displayName } from '../utils/mentions';
import { ReportReasonDialog } from './ReportReasonDialog';
import { useSharePost } from './useSharePost';

/**
 * Everything a viewer can do with a post beyond like and save: the author edits or deletes it;
 * anyone else removes their own tag, reports it, or blocks its author. Also shares it. Every
 * confirmation and result is a Material 3 dialog.
 *
 * Render `dialogs` once in the screen body. `onGone` runs when the post leaves the viewer's feed
 * (deleted, reported, author blocked), so a detail screen can close.
 */
export function usePostActions({ onGone }: { onGone?: () => void } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const alertRef = useRef<AlertMethods>(null);
  const [reporting, setReporting] = useState<Post | null>(null);
  const myId = userStore.id.peek() as string | undefined;

  const remove = useDeletePost();
  const removeTag = useRemoveMyTag();
  const reportPost = useReportPost();
  const block = useBlockUser();

  const tell = ({ title, message, onOk }: { title: string; message: string; onOk?: () => void }) =>
    alertRef.current?.alert({ title, message, buttons: [{ text: t('feed.ok'), onPress: onOk }] });

  const fail = (title: string) => (error: unknown) =>
    tell({
      title,
      message: feedErrorMessage({ error: error, fallback: t('feed.somethingWentWrong') }),
    });

  const share = useSharePost({
    onPhotoFailed: () =>
      tell({ title: t('feed.shareFailedTitle'), message: t('feed.shareFailed') }),
  });

  const confirmDelete = (post: Post) =>
    alertRef.current?.alert({
      title: t('feed.deletePostTitle'),
      message: t('feed.deletePostBody'),
      buttons: [
        { text: t('feed.cancel'), style: 'cancel' },
        {
          text: t('feed.delete'),
          style: 'destructive',
          onPress: () =>
            remove.mutate(post, { onSuccess: onGone, onError: fail(t('feed.deletePostFailed')) }),
        },
      ],
    });

  const confirmRemoveTag = (post: Post) => {
    if (!myId) return;
    alertRef.current?.alert({
      title: t('feed.removeTagTitle'),
      message: t('feed.removeTagBody'),
      buttons: [
        { text: t('feed.cancel'), style: 'cancel' },
        {
          text: t('feed.removeTagConfirm'),
          style: 'destructive',
          onPress: () =>
            removeTag.mutate({ post, userId: myId }, { onError: fail(t('feed.removeTagFailed')) }),
        },
      ],
    });
  };

  /** Blocking is shared with comments, so it takes the person rather than a post. */
  const confirmBlock = ({ person, onBlocked }: { person: PostAuthor; onBlocked?: () => void }) => {
    const name = displayName(person);
    alertRef.current?.alert({
      title: t('feed.blockTitle', { name }),
      message: t('feed.blockBody'),
      buttons: [
        { text: t('feed.cancel'), style: 'cancel' },
        {
          text: t('feed.blockConfirm'),
          style: 'destructive',
          onPress: () =>
            block.mutate(person.id, {
              onSuccess: onBlocked,
              onError: fail(t('feed.blockFailed', { name })),
            }),
        },
      ],
    });
  };

  const menuItems = (post: Post) => {
    if (post.userId === myId) {
      return [
        createDropdownItem({
          actionKey: 'edit',
          title: t('feed.editCaption'),
          icon: { name: 'pencil-outline' },
        }),
        createDropdownItem({
          actionKey: 'delete',
          title: t('feed.deletePost'),
          icon: { name: 'trash-can-outline' },
          destructive: true,
        }),
      ];
    }
    const amTagged = (post.tags ?? []).some((person) => person.id === myId);
    return [
      ...(amTagged
        ? [
            createDropdownItem({
              actionKey: 'remove-tag',
              title: t('feed.removeMyTag'),
              icon: { name: 'account-minus-outline' },
            }),
          ]
        : []),
      createDropdownItem({
        actionKey: 'report',
        title: t('feed.reportPost'),
        icon: { name: 'flag-outline' },
      }),
      ...(post.author
        ? [
            createDropdownItem({
              actionKey: 'block',
              title: t('feed.blockPerson', { name: displayName(post.author) }),
              icon: { name: 'cancel' },
              destructive: true,
            }),
          ]
        : []),
    ];
  };

  const onMenuItemPress = ({ post, actionKey }: { post: Post; actionKey: string }) => {
    if (actionKey === 'edit')
      router.push({ pathname: '/feed/edit/[id]', params: { id: String(post.id) } });
    else if (actionKey === 'delete') confirmDelete(post);
    else if (actionKey === 'remove-tag') confirmRemoveTag(post);
    else if (actionKey === 'report') setReporting(post);
    else if (actionKey === 'block' && post.author)
      confirmBlock({ person: post.author, onBlocked: onGone });
  };

  const dialogs = (
    <>
      <Alert ref={alertRef} title="" buttons={[]} />
      <ReportReasonDialog
        title={t('feed.reportPost')}
        visible={reporting !== null}
        onDismiss={() => setReporting(null)}
        onReport={(reason) => {
          const post = reporting;
          setReporting(null);
          if (!post) return;
          reportPost.mutate(
            { post, reason },
            {
              onSuccess: () =>
                tell({
                  title: t('feed.reportedTitle'),
                  message: t('feed.reportedBody'),
                  onOk: onGone,
                }),
              onError: fail(t('feed.reportFailed')),
            },
          );
        }}
      />
      {share.renderer}
    </>
  );

  return { menuItems, onMenuItemPress, confirmBlock, tell, share, dialogs, myId };
}
