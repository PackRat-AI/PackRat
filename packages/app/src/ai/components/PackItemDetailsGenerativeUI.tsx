import type { ToolInvocation } from '@packrat/app/ai';
import type { PackItem } from '@packrat/app/packs';
import { PackItemCard } from '@packrat/app/packs/components/PackItemCard';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
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
