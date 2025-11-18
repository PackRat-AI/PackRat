import { PackItemCard } from 'expo-app/features/packs/components/PackItemCard';
import type { PackItem } from 'expo-app/features/packs/types';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import type { ToolInvocation } from '../types';
import { ToolCard } from './ToolCard';

type PackItemToolInput = {
  itemId: string;
};

type PackItemToolOutput =
  | {
      success: true;
      data: PackItem;
    }
  | {
      success: false;
      error: string;
    };

export type PackItemTool = {
  type: 'tool-getPackItemDetails';
} & ToolInvocation<PackItemToolInput, PackItemToolOutput>;

interface PackItemDetailsGenerativeUIProps {
  toolInvocation: PackItemTool;
}

export function PackItemDetailsGenerativeUI({ toolInvocation }: PackItemDetailsGenerativeUIProps) {
  const { t } = useTranslation();
  
  switch (toolInvocation.state) {
    case 'input-streaming':
    case 'input-available':
      return <ToolCard text={t('ai.tools.fetchingItemDetails')} icon="loading" />;
    case 'output-available':
      if (toolInvocation.output.success) {
        const item = toolInvocation.output.data;
        return <PackItemCard item={item} isGenUI={true} />;
      } else {
        return <ToolCard text={t('ai.tools.couldntFetchItemDetails')} icon="error" />;
      }
    case 'output-error':
      return <ToolCard text={t('ai.tools.couldntFetchItemDetails')} icon="error" />;
    default:
      return null;
  }
}
