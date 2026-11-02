import type { FeedComment, FeedPost, SocialSettingsValues } from '@packrat/schemas/feed';

export type { FeedReportReason } from '@packrat/schemas/feed';

export type Post = FeedPost;
export type Comment = FeedComment;
export type PostAuthor = NonNullable<FeedPost['author']>;
export type SocialSettings = SocialSettingsValues;

/** Which list of posts a screen shows: everyone's, the viewer's saved posts, or posts they are tagged in. */
export type FeedScope = 'all' | 'saved' | 'tagged';

export interface FeedResponse {
  items: Post[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CommentsResponse {
  items: Comment[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LikeToggleResponse {
  liked: boolean;
  likeCount: number;
}
