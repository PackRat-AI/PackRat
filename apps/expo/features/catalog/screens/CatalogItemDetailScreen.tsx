import { Icon } from '@roninoss/icons';
import { ItemLinks } from 'expo-app/components/catalog/ItemLinks';
import { ItemReviews } from 'expo-app/components/catalog/ItemReviews';
import { Chip } from 'expo-app/components/initial/Chip';
import { Button } from 'expo-app/components/nativewindui/Button';
import { Text } from 'expo-app/components/nativewindui/Text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Linking, Platform, SafeAreaView, ScrollView, View } from 'react-native';
import { ErrorScreen } from '../../../screens/ErrorScreen';
import { LoadingSpinnerScreen } from '../../../screens/LoadingSpinnerScreen';
import { NotFoundScreen } from '../../../screens/NotFoundScreen';
import { useCatalogItemDetails } from '../hooks';

export function CatalogItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { data: item, isLoading, isError, refetch } = useCatalogItemDetails(id as string);
  const { colors } = useColorScheme();

  const handleAddToPack = () => {
    router.push({
      pathname: '/catalog/add-to-pack',
      params: { catalogItemId: item?.id },
    });
  };

  if (isLoading) {
    return <LoadingSpinnerScreen />;
  }

  if (isError) {
    return (
      <ErrorScreen
        title="Error loading item"
        message="Please try again later."
        onRetry={refetch}
        variant="destructive"
      />
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <NotFoundScreen title="Item not found" message="Please try again later." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        <Image
          source={{
            uri: item.image,
            ...(Platform.OS === 'android'
              ? {
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
                  },
                }
              : {}),
          }}
          className="h-64 w-full"
          resizeMode="contain"
        />

        <View className="bg-card p-4">
          <View className="mb-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">{item.name}</Text>
              {item.ratingValue && (
                <View className="flex-row items-center">
                  <Icon name="star" size={16} color={colors.yellow} />
                  <Text className="ml-1 text-sm text-muted-foreground">
                    {item.ratingValue.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
            {item.brand && <Text className="text-sm text-muted-foreground">{item.brand}</Text>}
          </View>

          {item.price && (
            <Text className="mb-4 text-xl text-foreground">
              ${item.price.toFixed(2)} {item.currency}
            </Text>
          )}

          <View className="mb-4">
            <Text className="mb-2 text-foreground">{item.description}</Text>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-1">
            <View className="mb-2 mr-4">
              <Text className="text-xs uppercase text-muted-foreground">WEIGHT</Text>
              <Chip textClassName="text-center text-xs" variant="secondary">
                {item.defaultWeight !== undefined && item.defaultWeightUnit ? (
                  <>
                    {item.defaultWeight} {item.defaultWeightUnit}
                  </>
                ) : (
                  'Not specified'
                )}
              </Chip>
            </View>

            {item.category && (
              <View className="mb-2 mr-4">
                <Text className="text-xs uppercase text-muted-foreground">CATEGORY</Text>
                <Chip textClassName="text-center text-xs" variant="secondary">
                  {item.category}
                </Chip>
              </View>
            )}

            {item.material && (
              <View className="mb-2 mr-4">
                <Text className="text-xs uppercase text-muted-foreground">MATERIAL</Text>
                <Chip textClassName="text-center text-xs" variant="secondary">
                  {item.material}
                </Chip>
              </View>
            )}

            {item.usageCount > 0 && (
              <View className="mb-2">
                <Text className="text-xs uppercase text-muted-foreground">USED IN</Text>
                <Chip textClassName="text-center text-xs" variant="secondary">
                  {item.usageCount} {item.usageCount === 1 ? 'pack' : 'packs'}
                </Chip>
              </View>
            )}
          </View>

          {item.availability && (
            <View className="mb-4 flex-row items-center">
              <Icon
                name={item.availability === 'In Stock' ? 'check-circle-outline' : 'exclamation'}
                size={16}
                color={item.availability === 'In Stock' ? colors.green : colors.yellow}
              />
              <Text className="ml-1 text-sm text-foreground">{item.availability}</Text>
            </View>
          )}

          {item.techs && Object.keys(item.techs).length > 0 && (
            <View className="mt-8">
              <Text variant="callout" className="mb-2">
                Specifications
              </Text>
              <View className="rounded-lg p-3">
                {Object.entries(item.techs).map(([key, value]) => (
                  <View key={key} className="mb-2 flex-row justify-between">
                    <Text className="text-sm text-muted-foreground">{key}</Text>
                    <Text className="text-sm font-medium text-foreground">{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Links Section */}
          {item.links && item.links.length > 0 && <ItemLinks links={item.links} />}

          {/* Reviews Section */}
          {item.reviews && item.reviews.length > 0 && (
            <View className="mt-2">
              <ItemReviews reviews={item.reviews} />
            </View>
          )}

          {item.productUrl && (
            <View className="mt-4">
              <Button
                variant="secondary"
                onPress={() => Linking.openURL(item.productUrl as string)}
              >
                <Text className="text-foreground">View on Retailer Site</Text>
              </Button>
            </View>
          )}

          <View className="mt-2">
            <Button onPress={handleAddToPack}>
              <Text>Add to Pack</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
