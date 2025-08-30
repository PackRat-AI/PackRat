import { PackCard } from 'expo-app/features/packs/components/PackCard';
import type { Pack } from 'expo-app/features/packs/types';
import type { ToolInvocation } from '../types';
import { ToolCard } from './ToolCard';

type PackDetailsToolOutput =
  | {
      success: true;
      data: Pack;
    }
  | {
      success: false;
      error: string;
    };

type PackDetailsToolInput = {
  packId: string;
};

export type PackDetailsTool = {
  type: 'tool-getPackDetails';
} & ToolInvocation<PackDetailsToolInput, PackDetailsToolOutput>;

interface PackDetailsGenerativeUIProps {
  toolInvocation: PackDetailsTool;
}

export function PackDetailsGenerativeUI({ toolInvocation }: PackDetailsGenerativeUIProps) {
  switch (toolInvocation.state) {
    case 'input-streaming':
    case 'input-available':
      return <ToolCard text="Fetching pack details..." icon="loading" />;
    case 'output-available':
      if (toolInvocation.output.success) {
        const pack = toolInvocation.output.data;

        return <PackCard isGenUI={true} pack={pack} />;
      } else {
        return <ToolCard text="Couldn't fetching pack details" icon="error" />;
      }
    case 'output-error':
      return <ToolCard text="Couldn't fetching pack details" icon="error" />;
    default:
      return null;
  }
}
