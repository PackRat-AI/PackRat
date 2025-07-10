import { Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView, View } from 'react-native';

export function CatalogItemsAuthWall() {
  const router = useRouter();
  const currentRoute = usePathname();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <LargeTitleHeader title="Catalog" backVisible={false} />

      <View className="flex-1 px-6 py-8">
        <View className="mb-8 items-center justify-center">
          <View className="bg-primary/10 mb-4 rounded-full p-6">
            <Icon name="clipboard-outline" size={64} color="text-primary" />
          </View>
          <Text variant="title1" className="text-center">
            Create Your Perfect Pack
          </Text>
          <Text variant="body" className="mb-6 text-center text-muted-foreground">
            Sign in to browse our complete items catalog and create personalized packs for all your
            adventures.
          </Text>
        </View>

        <Button
          onPress={() =>
            router.push({
              pathname: '/auth',
              params: { redirectTo: currentRoute },
            })
          }
          size="lg"
          variant="primary"
          className="mb-4 w-full"
        >
          <Text className="font-medium">Sign In</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
