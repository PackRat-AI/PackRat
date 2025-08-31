import { PackItemCard } from 'expo-app/features/packs/components/PackItemCard';
import type { PackItem } from 'expo-app/features/packs/types';
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
  switch (toolInvocation.state) {
    case 'input-streaming':
    case 'input-available':
      return <ToolCard text="Fetching item details..." icon="loading" />;
    case 'output-available':
      if (toolInvocation.output.success) {
        const item = toolInvocation.output.data;
        return <PackItemCard item={item} isGenUI={true} />;
      } else {
        return <ToolCard text={"Couldn't fetch item details"} icon="error" />;
      }
    case 'output-error':
      return <ToolCard text={"Couldn't fetch item details"} icon="error" />;
    default:
      return null;
  }
}
