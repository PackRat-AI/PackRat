import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { type Href, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useReportedContentCount } from '../hooks/useReportedContent';

export function ReportedContentTile() {
  const router = useRouter();
  const user = useUser();
  const { data, isLoading } = useReportedContentCount();
  const { t } = useTranslation();

  if (user?.role !== 'ADMIN') {
    return null; // Don't render if user is not an admin
  }

  const route: Href = {
    pathname: '/reported-ai-content',
  };

  const handlePress = () => {
    router.push(route);
  };

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-red-500">
            <Icon name="flag" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          {isLoading ? (
            <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
              {t('ai.reportedContent.loading')}
            </Text>
          ) : (
            <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
              {t('ai.reportedContent.pendingCount', { count: data?.count || 0 })}
            </Text>
          )}
          <ChevronRight />
        </View>
      }
      item={{
        title: t('ai.reportedContent.title'),
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
