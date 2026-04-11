import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import { TouchableOpacity, View } from 'react-native';
import type { Comment } from '../types';
import { formatAuthorName } from '../utils';

interface CommentItemProps {
  comment: Comment;
  onLike: (commentId: number) => void;
  onDelete?: (commentId: number) => void;
  currentUserId?: number;
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
          <Text className="font-semibold text-sm">{formatAuthorName(comment)}</Text>
          <Text className="text-xs text-muted-foreground">
            {getRelativeTime(comment.createdAt)}
          </Text>
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
