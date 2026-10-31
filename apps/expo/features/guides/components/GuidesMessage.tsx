import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';

interface GuidesMessageProps {
  icon: 'error' | 'empty' | 'search';
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}

const MATERIAL_ICON = Object.freeze({
  error: 'cloud-off',
  empty: 'auto-stories',
  search: 'search-off',
} as const);

/** Centered empty, error and no-results state shared by the Guides screens. */
export function GuidesMessage({ icon, title, body, action }: GuidesMessageProps) {
  const { colors } = useColorScheme();

  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Icon
        name={MATERIAL_ICON[icon]}
        size={48}
        color={colors.grey2}
        materialIcon={{ name: MATERIAL_ICON[icon], type: 'MaterialIcons' }}
      />
      <Text className="mt-4 text-center text-lg font-medium leading-6 text-foreground">
        {title}
      </Text>
      {body ? (
        <Text className="mt-1 text-center text-sm leading-5 text-muted-foreground" wrap>
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant="tonal"
          className="mt-6"
          onPress={action.onPress}
          testID={testIds.guides.messageAction}
        >
          <Text>{action.label}</Text>
        </Button>
      ) : null}
    </View>
  );
}
