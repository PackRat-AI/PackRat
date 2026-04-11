export interface PostAuthor {
  id: number;
  firstName: string | null;
  lastName: string | null;
}

export interface Post {
  id: number;
  userId: number;
  caption: string | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
  author?: PostAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface FeedResponse {
  items: Post[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  parentCommentId: number | null;
  createdAt: string;
  updatedAt: string;
  author?: PostAuthor;
  likeCount: number;
  likedByMe: boolean;
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
