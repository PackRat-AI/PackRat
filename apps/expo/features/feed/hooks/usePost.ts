import { useQuery } from '@tanstack/react-query';
import { getPost, getSharedPost } from '../lib/feedApi';
import { feedKeys } from './queryKeys';

export const usePost = (postId: number) =>
  useQuery({
    queryKey: feedKeys.post(postId),
    queryFn: () => getPost(postId),
    enabled: Number.isFinite(postId),
    retry: false,
  });

/** Resolves a share link's public id to the post, for opening a shared link in the app. */
export const useSharedPost = (publicId: string) =>
  useQuery({
    queryKey: feedKeys.shared(publicId),
    queryFn: () => getSharedPost(publicId),
    enabled: publicId.length > 0,
    retry: false,
  });
