import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { Chip } from 'expo-app/components/initial/Chip';
import { ExpandableText } from 'expo-app/components/initial/ExpandableText';
import { ItemLinks } from 'expo-app/features/catalog/components/ItemLinks';
import { ItemReviews } from 'expo-app/features/catalog/components/ItemReviews';
import { SimilarItems } from 'expo-app/features/catalog/components/SimilarItems';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { ErrorScreen } from 'expo-app/screens/ErrorScreen';
import { LoadingSpinnerScreen } from 'expo-app/screens/LoadingSpinnerScreen';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Text as RNText, SafeAreaView, ScrollView, View } from 'react-native';
import { CatalogItemImage } from '../components/CatalogItemImage';
import { useCatalogItemDetails } from '../hooks';

export function CatalogItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { data: item, isLoading, isError, refetch } = useCatalogItemDetails(id as string);
  const { colors } = useColorScheme();
  const MATERIAL_LENGTH_THRESHOLD = 60;

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
        <CatalogItemImage
          imageUrl={item.images?.[0]}
          resizeMode="contain"
          className="h-64 w-full"
        />

        <View className="bg-card p-4">
          <View className="mb-2">
            <View className="flex-row items-baseline justify-between">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground">{item.name}</Text>
              </View>
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

          {item.categories && item.categories.length > 0 && (
            <View className="mb-4">
              <Text className="mb-2 text-xs uppercase text-muted-foreground">CATEGORIES</Text>
              <View className="flex-row flex-wrap gap-2">
                {item.categories.map((category) => (
                  <Chip key={category} textClassName="text-xs" variant="outline">
                    <Text> {category}</Text>
                  </Chip>
                ))}
              </View>
            </View>
          )}

          <View className="mb-4">
            <Text className="mb-2 text-foreground">{item.description}</Text>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-1">
            <View className="mb-2 mr-4">
              <Text className="text-xs uppercase text-muted-foreground">WEIGHT</Text>
              <Chip textClassName="text-center" variant="secondary">
                <RNText>
                  {item.weight !== undefined && item.weightUnit
                    ? `${item.weight} ${item.weightUnit}`
                    : 'Not specified'}
                </RNText>
              </Chip>
            </View>

            {item.material && (
              <View className="mb-2 mr-4">
                <Text className="text-xs uppercase text-muted-foreground">MATERIAL</Text>
                {item.material.length < MATERIAL_LENGTH_THRESHOLD ? (
                  <Chip textClassName="text-center" variant="secondary">
                    <RNText>{item.material}</RNText>
                  </Chip>
                ) : (
                  <ExpandableText text={item.material} />
                )}
              </View>
            )}

            {item.usageCount && item.usageCount > 0 ? (
              <View className="mb-2">
                <Text className="text-xs uppercase text-muted-foreground">USED IN</Text>
                <Chip textClassName="text-center" variant="secondary">
                  <RNText>
                    {item.usageCount} {item.usageCount === 1 ? 'pack' : 'packs'}
                  </RNText>
                </Chip>
              </View>
            ) : null}
          </View>

          {item.availability && (
            <View className="mb-4 flex-row items-center">
              <Ionicons
                name={
                  item.availability === 'in_stock'
                    ? 'checkmark-circle-outline'
                    : item.availability === 'out_of_stock'
                      ? 'close-circle-outline'
                      : 'time-outline'
                }
                size={16}
                color={
                  item.availability === 'in_stock'
                    ? '#22c55e' // green
                    : item.availability === 'out_of_stock'
                      ? '#ef4444' // red
                      : '#f59e0b' // amber for preorder
                }
              />
              <Text className="ml-1 text-sm text-foreground">
                {item.availability === 'in_stock'
                  ? 'In Stock'
                  : item.availability === 'out_of_stock'
                    ? 'Out of Stock'
                    : 'Pre-order'}
              </Text>
            </View>
          )}

          {item.techs && Object.keys(item.techs).length > 0 && (
            <View className="mt-8">
              <Text variant="callout" className="mb-2">
                Specifications
              </Text>
              <View className="rounded-lg p-3 gap-4">
                {Object.entries(item.techs).map(([key, value]) => (
                  <View key={key} className="gap-1">
                    <Text className="text-xs text-muted-foreground uppercase">{key}</Text>
                    <Text className="font-medium text-foreground">{value}</Text>
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

          {/* Similar Items Section */}
          <SimilarItems
            catalogItemId={item.id.toString()}
            itemName={item.name}
            limit={5}
            threshold={0.1}
          />

          <View className="mt-4">
            <Button variant="secondary" onPress={() => Linking.openURL(item.productUrl as string)}>
              <Text className="text-foreground">View on Retailer Site</Text>
            </Button>
          </View>

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
