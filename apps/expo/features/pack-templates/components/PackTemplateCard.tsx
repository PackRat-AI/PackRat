import { useActionSheet } from '@expo/react-native-action-sheet';
import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { router } from 'expo-router';
import { isArray } from 'radash';
import { Image, Pressable, View } from 'react-native';
import { useDeletePackTemplate, usePackTemplateDetails } from '../hooks';
import type { PackTemplate } from '../types';
import { AppTemplateBadge } from './AppTemplateBadge';

type PackTemplateCard = {
  templateId: string;
  onPress: (template: PackTemplate) => void;
};

export function PackTemplateCard({ templateId, onPress }: PackTemplateCard) {
  const template = usePackTemplateDetails(templateId);
  const deleteTemplate = useDeletePackTemplate();
  const user = useUser();

  const { colors } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();

  const handleActionsPress = () => {
    console.log('template.userId', template.userId);
    console.log('user.id', user?.id);
    const options =
      user && (template.userId === user.id || (template.isAppTemplate && user.role === 'ADMIN'))
        ? ['View Details', 'Edit', 'Delete', 'Cancel']
        : ['View Details', 'Cancel'];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf('Delete');
    const viewDetailsIndex = 0;
    const editIndex = options.indexOf('Edit');

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: template.name,
        message: template.description,
        containerStyle: {
          backgroundColor: colors.card,
        },
        textStyle: {
          color: colors.foreground,
        },
        titleTextStyle: {
          color: colors.foreground,
          fontWeight: '600',
        },
        messageTextStyle: {
          color: colors.grey2,
        },
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case viewDetailsIndex:
            onPress(template);
            break;
          case editIndex:
            router.push({ pathname: '/pack-templates/[id]/edit', params: { id: template.id } });
            break;
          case destructiveButtonIndex:
            appAlert.current?.alert({
              title: 'Delete Pack Template?',
              message: 'This action cannot be undone.',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => deleteTemplate(template.id) },
              ],
            });
            break;
        }
      },
    );
  };

  return (
    <Pressable
      className="mb-4 overflow-hidden rounded-xl bg-card shadow-sm"
      onPress={() => onPress(template)}
    >
      {template.image && (
        <Image source={{ uri: template.image }} className="h-40 w-full" resizeMode="cover" />
      )}
      <View className="p-4">
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{template.name}</Text>
            {template.category && <Text variant="footnote">{template.category}</Text>}
          </View>
          <Button variant="plain" size="icon" onPress={handleActionsPress}>
            <Icon name="dots-horizontal" size={20} color={colors.grey2} />
          </Button>
        </View>

        {template.description && (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {template.description}
          </Text>
        )}

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row gap-2">
            <WeightBadge weight={template.baseWeight ?? 0} unit="g" type="base" />
            <WeightBadge weight={template.totalWeight ?? 0} unit="g" type="total" />
          </View>
          <Text className="text-xs text-foreground">
            {template.items && isArray(template.items) && template.items.length > 0
              ? `${template.items.length} item${template.items.length > 1 ? 's' : ''}`
              : '0 items'}
          </Text>
        </View>

        <View className="flex-row items-end justify-between">
          {template.tags && isArray(template.tags) && template.tags.length > 0 ? (
            <View className="mt-3 flex-row items-center flex-wrap">
              {template.tags.map((tag) => (
                <View
                  key={tag}
                  className="mb-1 mr-2 rounded-full bg-neutral-200 dark:bg-neutral-700 px-2 py-1"
                >
                  <Text className="text-xs text-foreground">#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {template.isAppTemplate && <AppTemplateBadge />}
        </View>
      </View>
    </Pressable>
  );
}
