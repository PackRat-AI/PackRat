import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateReportLists } from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import {
  blockUser,
  createPost,
  deletePost,
  removeMyTag,
  report,
  setSaved,
  toggleLike,
  updateCaption,
} from '../lib/feedApi';
import type { FeedReportReason, Post } from '../types';
import { removeCachedPosts, updateCachedPost } from './postCache';
import { feedKeys } from './queryKeys';

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKeys.lists }),
  });
};

/** Likes or unlikes at once, then settles on the server's count. */
export const useTogglePostLike = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: Post) => toggleLike(post.id),
    onMutate: (post) =>
      updateCachedPost({
        queryClient,
        postId: post.id,
        update: (p) => ({
          ...p,
          likedByMe: !post.likedByMe,
          likeCount: Math.max(0, p.likeCount + (post.likedByMe ? -1 : 1)),
        }),
      }),
    onSuccess: ({ liked, likeCount }, post) =>
      updateCachedPost({
        queryClient,
        postId: post.id,
        update: (p) => ({ ...p, likedByMe: liked, likeCount }),
      }),
    onError: (_error, post) =>
      updateCachedPost({
        queryClient,
        postId: post.id,
        update: (p) => ({ ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }),
      }),
  });
};

export const useTogglePostSave = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: Post) => setSaved({ postId: post.id, saved: !post.savedByMe }),
    onMutate: (post) =>
      updateCachedPost({
        queryClient,
        postId: post.id,
        update: (p) => ({ ...p, savedByMe: !post.savedByMe }),
      }),
    onError: (_error, post) =>
      updateCachedPost({
        queryClient,
        postId: post.id,
        update: (p) => ({ ...p, savedByMe: post.savedByMe }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: feedKeys.list('saved') }),
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: Post) => deletePost(post.id),
    onSuccess: (_data, post) => {
      removeCachedPosts({ queryClient, keep: (p) => p.id !== post.id });
      queryClient.removeQueries({ queryKey: feedKeys.post(post.id) });
    },
  });
};

export const useUpdateCaption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCaption,
    onSuccess: (updated) =>
      updateCachedPost({
        queryClient,
        postId: updated.id,
        update: (p) => ({ ...p, ...updated, likedByMe: p.likedByMe, savedByMe: p.savedByMe }),
      }),
  });
};

export const useRemoveMyTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ post }: { post: Post; userId: string }) => removeMyTag(post.id),
    onSuccess: (_data, { post, userId }) => {
      updateCachedPost({
        queryClient,
        postId: post.id,
        update: (p) => ({ ...p, tags: (p.tags ?? []).filter((person) => person.id !== userId) }),
      });
      queryClient.invalidateQueries({ queryKey: feedKeys.list('tagged') });
    },
  });
};

export const useReportPost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ post, reason }: { post: Post; reason: FeedReportReason }) =>
      report({ postId: post.id, reason }),
    onSuccess: (_data, { post }) =>
      removeCachedPosts({ queryClient, keep: (p) => p.id !== post.id }),
  });
};

/** Blocks a person; their posts leave every list at once and the rest refreshes. */
export const useBlockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockUser,
    onSuccess: (_data, userId) => {
      removeCachedPosts({ queryClient, keep: (p) => p.userId !== userId });
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
      invalidateReportLists(queryClient);
    },
  });
};
