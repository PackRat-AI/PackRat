import { Alert, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { CategoryBadge } from 'expo-app/components/initial/CategoryBadge';
import { Chip } from 'expo-app/components/initial/Chip';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { NotFoundScreen } from 'expo-app/screens/NotFoundScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { PackTemplateItemCard } from '../components/PackTemplateItemCard';
import { useDeletePackTemplate, usePackTemplateDetails } from '../hooks';
import type { PackTemplateItem } from '../types';

const LOGO_SOURCE = require('expo-app/assets/adaptive-icon.png');

export function PackTemplateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('all');

  const packTemplate = usePackTemplateDetails(id as string);
  const deletePackTemplate = useDeletePackTemplate();
  const { colors } = useColorScheme();

  const user = useUser();

  const getTabStyle = (tab: string) => {
    return `flex-1 items-center py-4 ${activeTab === tab ? 'border-b-2 border-primary' : ''}`;
  };

  const getTabTextStyle = (tab: string) => {
    return activeTab === tab ? 'text-primary' : 'text-muted-foreground';
  };

  const filteredItems = (() => {
    if (!packTemplate?.items) return [];
    switch (activeTab) {
      case 'worn':
        return packTemplate.items.filter((item) => item.worn);
      case 'consumable':
        return packTemplate.items.filter((item) => item.consumable);
      default:
        return packTemplate.items;
    }
  })();

  const handleItemPress = useCallback(
    (item: PackTemplateItem) => {
      router.push({
        pathname: '/templateItem/[id]',
        params: {
          id: item.id,
          packTemplateId: packTemplate.id,
        },
      });
    },
    [router, packTemplate.id],
  );

  if (!packTemplate) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <NotFoundScreen title="Template not found" message="Please try again later." />
      </SafeAreaView>
    );
  }

  const handleCreate = () => {
    router.push({
      pathname: '/pack/new',
      params: { templateId: packTemplate.id },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        {packTemplate.image && (
          <Image source={{ uri: packTemplate.image }} className="h-48 w-full" resizeMode="cover" />
        )}

        <View className="mb-4 bg-card p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">{packTemplate.name}</Text>
            {packTemplate.category && <CategoryBadge category={packTemplate.category} />}
          </View>

          {packTemplate.description && (
            <Text className="mb-4 text-muted-foreground">{packTemplate.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">ITEMS</Text>
              <Chip textClassName="text-center text-xs" variant="secondary">
                {packTemplate.items?.length || 0}
              </Chip>
            </View>
          </View>

          <View className="flex-row justify-between">
            {packTemplate.tags && packTemplate.tags.length > 0 && (
              <View className="flex-row flex-wrap">
                {packTemplate.tags.map((tag) => (
                  <Chip
                    key={tag}
                    className="mb-1 mr-2"
                    textClassName="text-xs text-center"
                    variant="outline"
                  >
                    #{tag}
                  </Chip>
                ))}
              </View>
            )}
            <View className="ml-auto flex-row items-center">
              {packTemplate.isAppTemplate && (
                <View
                  className="flex-row items-center justify-between rounded-md pr-2"
                  style={{ backgroundColor: colors.grey2 }}
                >
                  <Image source={LOGO_SOURCE} className="h-8 w-8 rounded-md" resizeMode="contain" />
                  <Text className="text-xs text-foreground" style={{ color: colors.background }}>
                    App Template
                  </Text>
                </View>
              )}
              {(!packTemplate.isAppTemplate || user?.role === 'ADMIN') && (
                <Alert
                  title="Delete template?"
                  message="Are you sure you want to delete this pack template? This action cannot be undone."
                  buttons={[
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'OK',
                      onPress: () => {
                        deletePackTemplate(packTemplate.id);
                        if (router.canGoBack()) {
                          router.back();
                        }
                      },
                    },
                  ]}
                >
                  <Button variant="plain" size="icon">
                    <Icon name="trash-can" color={colors.grey2} size={21} />
                  </Button>
                </Alert>
              )}
            </View>
          </View>
        </View>

        <View className="bg-card">
          <View className="flex-row border-b border-border">
            <TouchableOpacity className={getTabStyle('all')} onPress={() => setActiveTab('all')}>
              <Text className={getTabTextStyle('all')}>All Items</Text>
            </TouchableOpacity>
            <TouchableOpacity className={getTabStyle('worn')} onPress={() => setActiveTab('worn')}>
              <Text className={getTabTextStyle('worn')}>Worn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={getTabStyle('consumable')}
              onPress={() => setActiveTab('consumable')}
            >
              <Text className={getTabTextStyle('consumable')}>Consumable</Text>
            </TouchableOpacity>
          </View>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <View key={item.id} className="px-4 pt-3">
                <PackTemplateItemCard
                  item={item}
                  belongsToAppTemplate={packTemplate.isAppTemplate}
                  onPress={handleItemPress}
                />
              </View>
            ))
          ) : (
            <View className="items-center justify-center p-4">
              <Text className="text-muted-foreground">No items found</Text>
            </View>
          )}
          {(!packTemplate.isAppTemplate || user?.role === 'ADMIN') && (
            <Button
              className="m-4"
              onPress={() =>
                router.push({
                  pathname: '/templateItem/new',
                  params: { packTemplateId: packTemplate.id },
                })
              }
            >
              <Text>Add New Item</Text>
            </Button>
          )}
          <Button className="mx-4 mb-8" variant="secondary" onPress={handleCreate}>
            <Text>Use This Template</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
