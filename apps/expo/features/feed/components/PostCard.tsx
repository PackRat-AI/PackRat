import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Post } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface PostCardProps {
  post: Post;
  onLike: (postId: number) => void;
  onDelete?: (postId: number) => void;
  currentUserId?: number;
}

function buildPostImageUrl(imageKey: string): string {
  return `${clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL}/${imageKey}`;
}

function formatAuthorName(post: Post): string {
  if (!post.author) return 'Unknown';
  const { firstName, lastName } = post.author;
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
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export const PostCard: React.FC<PostCardProps> = ({ post, onLike, onDelete, currentUserId }) => {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push({ pathname: '/feed/[id]', params: { id: post.id } });
  }, [router, post.id]);

  const handleLike = useCallback(() => {
    onLike(post.id);
  }, [onLike, post.id]);

  const isOwner = currentUserId === post.userId;

  return (
    <View className="mb-4 bg-card rounded-2xl overflow-hidden border border-border/50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center gap-2">
          <View className="h-9 w-9 rounded-full bg-primary/20 items-center justify-center">
            <Icon name="account-circle" size={22} color={colors.primary} />
          </View>
          <View>
            <Text className="font-semibold text-sm">{formatAuthorName(post)}</Text>
            <Text className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</Text>
          </View>
        </View>
        {isOwner && onDelete && (
          <TouchableOpacity onPress={() => onDelete(post.id)} hitSlop={8}>
            <Icon name="delete" size={20} color={colors.grey2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Images */}
      {post.images.length > 0 && (
        <Pressable onPress={handlePress}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
          >
            {post.images.map((img, idx) => (
              <Image
                key={`${img}-${idx}`}
                source={{ uri: buildPostImageUrl(img) }}
                style={[styles.image, { width: SCREEN_WIDTH - 32 }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {post.images.length > 1 && (
            <View className="absolute bottom-2 right-3 bg-black/50 rounded-full px-2 py-0.5">
              <Text className="text-white text-xs">{post.images.length} photos</Text>
            </View>
          )}
        </Pressable>
      )}

      {/* Caption */}
      {post.caption && (
        <Pressable onPress={handlePress}>
          <Text className="px-4 pt-2 text-sm" numberOfLines={3}>
            {post.caption}
          </Text>
        </Pressable>
      )}

      {/* Actions */}
      <View className="flex-row items-center gap-4 px-4 py-3">
        <TouchableOpacity onPress={handleLike} className="flex-row items-center gap-1">
          <Icon
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={22}
            color={post.likedByMe ? '#ef4444' : colors.grey2}
          />
          {post.likeCount > 0 && (
            <Text className="text-sm text-muted-foreground">{post.likeCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePress} className="flex-row items-center gap-1">
          <Icon name="message-outline" size={22} color={colors.grey2} />
          {post.commentCount > 0 && (
            <Text className="text-sm text-muted-foreground">{post.commentCount}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  imageScroll: {
    height: 260,
  },
  image: {
    height: 260,
  },
});
