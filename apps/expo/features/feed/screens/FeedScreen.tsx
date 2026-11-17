import { withAuthWall } from 'expo-app/features/auth/hocs/withAuthWall';
import { FeedAuthWall } from './FeedAuthWall';
import { PostListScreen } from './PostListScreen';

export const FeedScreen = withAuthWall({
  Component: () => <PostListScreen scope="all" />,
  AuthWall: FeedAuthWall,
});
