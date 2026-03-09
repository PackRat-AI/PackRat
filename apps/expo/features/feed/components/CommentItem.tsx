import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { TouchableOpacity, View } from 'react-native';
import type { Comment } from '../types';

interface CommentItemProps {
  comment: Comment;
  onLike: (commentId: number) => void;
  onDelete?: (commentId: number) => void;
  currentUserId?: number;
}

function formatAuthor(comment: Comment): string {
  if (!comment.author) return 'Unknown';
  const { firstName, lastName } = comment.author;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  return 'User';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onLike,
  onDelete,
  currentUserId,
}) => {
  const { colors } = useColorScheme();
  const isOwner = currentUserId === comment.userId;

  return (
    <View className={`flex-row gap-2 py-2 ${comment.parentCommentId ? 'ml-8' : ''}`}>
      <View className="h-8 w-8 rounded-full bg-primary/20 items-center justify-center flex-shrink-0">
        <Icon name="account-circle" size={18} color={colors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text className="font-semibold text-sm">{formatAuthor(comment)}</Text>
          <Text className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</Text>
        </View>
        <Text className="text-sm mt-0.5">{comment.content}</Text>
        <View className="flex-row items-center gap-3 mt-1">
          <TouchableOpacity
            onPress={() => onLike(comment.id)}
            className="flex-row items-center gap-1"
          >
            <Icon
              name={comment.likedByMe ? 'heart' : 'heart-outline'}
              size={16}
              color={comment.likedByMe ? '#ef4444' : colors.grey2}
            />
            {comment.likeCount > 0 && (
              <Text className="text-xs text-muted-foreground">{comment.likeCount}</Text>
            )}
          </TouchableOpacity>
          {isOwner && onDelete && (
            <TouchableOpacity onPress={() => onDelete(comment.id)}>
              <Icon name="delete" size={16} color={colors.grey2} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};
