'use client';
import {
  useAddCommentMutation,
  useCurrentUser,
  useFeed,
  useTogglePostLikeMutation,
} from '@packrat/app';
import {
  Bookmark,
  ChevronLeft,
  Clock,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  TrendingUp,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ShareModal } from 'web-app/components/modals';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'web-app/components/ui/dropdown-menu';
import { Skeleton } from 'web-app/components/ui/skeleton';
import type { Post } from 'web-app/lib/types';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

type FeedFilter = 'trending' | 'recent' | 'following';

export function FeedScreen() {
  const { fw } = useWeight();
  const [filter, setFilter] = useState<FeedFilter>('trending');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const [savedPosts, setSavedPosts] = useState<Set<number>>(new Set());

  const { data: feedData, isLoading } = useFeed();
  const allPosts = feedData?.pages.flatMap((p) => p?.items ?? []) ?? [];

  const toggleLikeMutation = useTogglePostLikeMutation();

  const toggleLike = (postId: number) => {
    toggleLikeMutation.mutate(postId);
  };

  const toggleSave = (postId: number) => {
    setSavedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  if (selectedPost) {
    return (
      <PostDetail
        post={selectedPost}
        onBack={() => setSelectedPost(null)}
        fw={fw}
        isLiked={selectedPost.likedByMe}
        isSaved={savedPosts.has(selectedPost.id)}
        onLike={() => toggleLike(selectedPost.id)}
        onSave={() => toggleSave(selectedPost.id)}
        onShare={() => setSharingPost(selectedPost)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 border-b border-border sticky top-0 z-10 bg-background">
        <h1 className="text-2xl font-bold tracking-tight mb-3">Community</h1>
        {/* Filter tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(
            [
              { id: 'trending', label: 'Trending', icon: TrendingUp },
              { id: 'recent', label: 'Recent', icon: Clock },
              { id: 'following', label: 'Following', icon: Users },
            ] as { id: FeedFilter; label: string; icon: React.ElementType }[]
          ).map((f) => (
            <button
              type="button"
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all',
                filter === f.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              <f.icon className="h-3 w-3" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-3 pb-24">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
              <div className="flex gap-3">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))
        ) : filter === 'following' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-semibold">No one followed yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Follow other packers to see their updates here
            </p>
          </div>
        ) : (
          allPosts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              fw={fw}
              isLiked={post.likedByMe}
              isSaved={savedPosts.has(post.id)}
              onClick={() => setSelectedPost(post)}
              onLike={() => toggleLike(post.id)}
              onSave={() => toggleSave(post.id)}
              onShare={() => setSharingPost(post)}
            />
          ))
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        open={!!sharingPost}
        onClose={() => setSharingPost(null)}
        packName={sharingPost?.caption?.slice(0, 30) ?? 'Post'}
        packId={String(sharingPost?.id ?? '')}
      />
    </div>
  );
}

function FeedPostCard({
  post,
  fw: _fw,
  isLiked,
  isSaved,
  onClick,
  onLike,
  onSave,
  onShare,
}: {
  post: Post;
  fw: (g: number) => string;
  isLiked: boolean;
  isSaved: boolean;
  onClick: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  const authorName = post.author
    ? `${post.author.firstName ?? ''} ${post.author.lastName ?? ''}`.trim() || 'Anonymous'
    : 'Anonymous';

  const initials = post.author
    ? `${post.author.firstName?.[0] ?? ''}${post.author.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Post header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#bf5af2] shrink-0 text-white text-xs font-bold">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{authorName}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem className="gap-2">Follow {authorName}</DropdownMenuItem>
            <DropdownMenuItem className="gap-2">Report</DropdownMenuItem>
            <DropdownMenuItem className="gap-2">Hide</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Caption - clickable */}
      <button type="button" onClick={onClick} className="w-full text-left px-4 pb-3">
        <p className="text-sm leading-relaxed">{post.caption}</p>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 pb-4 pt-1 border-t border-border">
        <button
          type="button"
          onClick={onLike}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isLiked ? 'fill-[#fe4336] text-[#fe4336]' : 'text-muted-foreground',
            )}
          />
          <span className={cn(isLiked ? 'text-[#fe4336]' : 'text-muted-foreground')}>
            {post.likeCount}
          </span>
        </button>
        <button
          type="button"
          onClick={onClick}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onSave}
          className={cn(
            'p-2 rounded-xl transition-colors',
            isSaved ? 'text-[#bf5af2]' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
        </button>
      </div>
    </div>
  );
}

// ─── Post Detail View ────────────────────────────────────────────────────────
interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
}

const mockComments: Comment[] = [
  {
    id: 'c1',
    username: 'Jake M.',
    avatar: 'JM',
    text: 'Great setup! What sleeping pad are you using?',
    time: '2h',
    likes: 5,
  },
  {
    id: 'c2',
    username: 'Sarah C.',
    avatar: 'SC',
    text: 'Love the gear choices. That quilt is a beast.',
    time: '4h',
    likes: 12,
  },
  {
    id: 'c3',
    username: 'Alex P.',
    avatar: 'AP',
    text: 'Sub 7lb base weight is goals',
    time: '6h',
    likes: 8,
  },
];

function PostDetail({
  post,
  onBack,
  fw: _fw,
  isLiked,
  isSaved,
  onLike,
  onSave,
  onShare,
}: {
  post: Post;
  onBack: () => void;
  fw: (g: number) => string;
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  const [commentInput, setCommentInput] = useState('');
  const [comments, _setComments] = useState(mockComments);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const addCommentMutation = useAddCommentMutation();
  const { data: currentUserData } = useCurrentUser();
  const me = (currentUserData as { user?: { firstName?: string; lastName?: string } } | null)?.user;
  const myInitials = me
    ? `${me.firstName?.[0] ?? ''}${me.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';

  const authorName = post.author
    ? `${post.author.firstName ?? ''} ${post.author.lastName ?? ''}`.trim() || 'Anonymous'
    : 'Anonymous';

  const initials = post.author
    ? `${post.author.firstName?.[0] ?? ''}${post.author.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';

  const addComment = () => {
    if (!commentInput.trim()) return;
    addCommentMutation.mutate({ postId: post.id, body: { content: commentInput.trim() } });
    setCommentInput('');
  };

  const toggleCommentLike = (id: string) => {
    setLikedComments((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-border sticky top-0 z-10 bg-background shrink-0">
        <button type="button" onClick={onBack} className="text-primary">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#bf5af2] text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{authorName}</p>
          <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {/* Caption */}
        <p className="text-base leading-relaxed mb-4">{post.caption}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onLike}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors',
              isLiked
                ? 'bg-[#fe4336]/15 text-[#fe4336]'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
            <span>{post.likeCount}</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors',
              isSaved
                ? 'bg-[#bf5af2]/15 text-[#bf5af2]'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Bookmark className={cn('h-5 w-5', isSaved && 'fill-current')} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>

        {/* Comments */}
        <div className="pb-20">
          <h3 className="font-semibold text-sm mb-3">Comments ({comments.length})</h3>
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                  {comment.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{comment.username}</span>
                    <span className="text-xs text-muted-foreground">{comment.time}</span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{comment.text}</p>
                  <button
                    type="button"
                    onClick={() => toggleCommentLike(comment.id)}
                    className={cn(
                      'flex items-center gap-1 mt-1.5 text-xs transition-colors',
                      likedComments.has(comment.id)
                        ? 'text-[#fe4336]'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Heart
                      className={cn('h-3.5 w-3.5', likedComments.has(comment.id) && 'fill-current')}
                    />
                    <span>{comment.likes + (likedComments.has(comment.id) ? 1 : 0)}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment Input */}
      <div className="px-4 pb-6 pt-3 md:px-6 border-t border-border flex items-end gap-2 shrink-0 bg-background">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#bf5af2] text-white text-xs font-bold shrink-0">
          {myInitials}
        </div>
        <input
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addComment()}
          placeholder="Add a comment..."
          className="flex-1 rounded-2xl bg-muted px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={addComment}
          disabled={!commentInput.trim()}
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center transition-all',
            commentInput.trim() ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
