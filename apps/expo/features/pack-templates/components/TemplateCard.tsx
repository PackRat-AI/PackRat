import { Alert } from '@packrat/ui/nativewindui';
import { Button } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { CategoryBadge } from 'expo-app/components/initial/CategoryBadge';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { isArray } from 'radash';
import { Image, Pressable, Text, View } from 'react-native';
import { useDeletePackTemplate, usePackTemplateDetails } from '../hooks';
import type { PackTemplate } from '../types';

type TemplateCardProps = {
  templateId: string;
  onPress: (template: PackTemplate) => void;
};

const LOGO_SOURCE = require('expo-app/assets/adaptive-icon.png');

export function TemplateCard({ templateId, onPress }: TemplateCardProps) {
  const template = usePackTemplateDetails(templateId);
  const deleteTemplate = useDeletePackTemplate();
  const { colors } = useColorScheme();
  const user = useUser();

  return (
    <Pressable
      className="mb-4 overflow-hidden rounded-xl bg-card shadow-sm"
      onPress={() => onPress(template)}
    >
      {template.image && (
        <Image source={{ uri: template.image }} className="h-40 w-full" resizeMode="cover" />
      )}
      <View className="p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">{template.name}</Text>
          <CategoryBadge category={template.category} />
        </View>

        {template.description && (
          <Text className="mb-3 text-foreground" numberOfLines={2}>
            {template.description}
          </Text>
        )}

        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-2">
            {template.totalWeight >= 0 ? (
              <WeightBadge weight={template.totalWeight} unit="g" type="total" />
            ) : null}
          </View>
          {template.items && isArray(template.items) && template.items.length > 0 ? (
            <Text className="text-xs text-foreground">{template.items.length} items</Text>
          ) : null}
        </View>

        <View className="flex-row items-baseline justify-between">
          {template.tags && isArray(template.tags) && template.tags.length > 0 ? (
            <View className="mt-3 flex-row flex-wrap">
              {template.tags.map((tag, index) => (
                <View key={index} className="mb-1 mr-2 rounded-full bg-background px-2 py-1">
                  <Text className="text-xs text-foreground">#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View className="ml-auto flex-row items-center">
            {template.isAppTemplate && (
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
            {(!template.isAppTemplate || user?.role === 'ADMIN') && (
              <Alert
                title="Delete template?"
                message="Are you sure you want to delete this template? This action cannot be undone."
                buttons={[
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'OK',
                    onPress: () => {
                      deleteTemplate(template.id);
                    },
                  },
                ]}
              >
                <Button variant="plain" size="icon">
                  <Icon name="trash-can" size={21} color={colors.grey2} />
                </Button>
              </Alert>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
