import { ActivityIndicator, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommentItem } from '../components/CommentItem';
import {
  useAddComment,
  useDeleteComment,
  usePostComments,
  useToggleCommentLike,
  useTogglePostLike,
} from '../hooks';
import type { Comment, Post } from '../types';
import { buildPostImageUrl } from '../utils';

interface PostDetailScreenProps {
  post: Post;
  currentUserId?: number;
}

export const PostDetailScreen = ({ post, currentUserId }: PostDetailScreenProps) => {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const {
    data: commentsData,
    isLoading: isLoadingComments,
    isRefetching: isRefetchingComments,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePostComments(post.id);

  const { mutate: togglePostLike } = useTogglePostLike();
  const { mutate: addComment, isPending: isAddingComment } = useAddComment();
  const { mutate: toggleCommentLike } = useToggleCommentLike();
  const { mutate: deleteComment } = useDeleteComment();

  const comments = commentsData?.pages.flatMap((p) => p.items) ?? [];

  const handlePostLike = useCallback(() => {
    togglePostLike(post.id);
  }, [togglePostLike, post.id]);

  const handleAddComment = useCallback(() => {
    const text = commentText.trim();
    if (!text) return;
    addComment(
      { postId: post.id, content: text },
      {
        onSuccess: () => {
          setCommentText('');
          inputRef.current?.blur();
        },
      },
    );
  }, [commentText, addComment, post.id]);

  const handleCommentLike = useCallback(
    (commentId: number) => {
      toggleCommentLike({ postId: post.id, commentId });
    },
    [toggleCommentLike, post.id],
  );

  const handleCommentDelete = useCallback(
    (commentId: number) => {
      deleteComment({ postId: post.id, commentId });
    },
    [deleteComment, post.id],
  );

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        onLike={handleCommentLike}
        onDelete={handleCommentDelete}
        currentUserId={currentUserId}
      />
    ),
    [handleCommentLike, handleCommentDelete, currentUserId],
  );

  const renderHeader = () => (
    <View>
      {/* Images */}
      {post.images.length > 0 && (
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
              style={styles.image}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* Post info */}
      <View className="px-4 py-3">
        {post.caption && <Text className="text-base mb-3">{post.caption}</Text>}

        {/* Like row */}
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={handlePostLike} className="flex-row items-center gap-1.5">
            <Icon
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={22}
              color={post.likedByMe ? '#ef4444' : colors.grey2}
            />
            <Text className="text-sm text-muted-foreground">{post.likeCount}</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <Icon name="message-outline" size={22} color={colors.grey2} />
            <Text className="text-sm text-muted-foreground">{post.commentCount}</Text>
          </View>
        </View>
      </View>

      {/* Comments header */}
      <View className="px-4 pb-2 border-t border-border/50 pt-3">
        <Text className="font-semibold text-base">{t('feed.comments')}</Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {isLoadingComments ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 16 }}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          refreshing={isRefetchingComments}
          onRefresh={refetch}
          ItemSeparatorComponent={() => <View className="h-px bg-border/30 mx-4" />}
          ListEmptyComponent={
            <View className="items-center py-6">
              <Text className="text-muted-foreground">{t('feed.noComments')}</Text>
            </View>
          }
        />
      )}

      {/* Comment input */}
      <View className="border-t border-border/50 px-4 py-2 flex-row items-center gap-2 bg-background">
        <TextInput
          ref={inputRef}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={t('feed.addComment')}
          placeholderTextColor={colors.grey2}
          className="flex-1 rounded-full border border-border px-4 py-2 text-sm"
          style={{ color: colors.foreground }}
          multiline={false}
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleAddComment}
        />
        <TouchableOpacity
          onPress={handleAddComment}
          disabled={!commentText.trim() || isAddingComment}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary"
          style={{ opacity: !commentText.trim() || isAddingComment ? 0.5 : 1 }}
        >
          {isAddingComment ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  imageScroll: {
    height: 300,
  },
  image: {
    width: SCREEN_WIDTH,
    height: 300,
  },
});
