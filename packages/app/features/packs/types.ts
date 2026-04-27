import type { CatalogItem } from 'app/features/catalog/types';
import type { PackTemplateItem } from 'app/features/pack-templates/types';
import type { PackCategory, WeightUnit } from 'app/types';

export type { PackCategory, WeightUnit };

export interface PackItem {
  id: string;
  name: string;
  description?: string;
  weight: number;
  weightUnit: WeightUnit;
  quantity: number;
  category: string;
  consumable: boolean;
  worn: boolean;
  notes?: string;
  image?: string | null;
  packId: string;
  pack?: Pack | null;
  templateItemId?: string | null;
  templateItem?: PackTemplateItem | null;
  catalogItemId?: number;
  catalogItem?: CatalogItem | null;
  userId?: number;
  deleted: boolean;
  isAIGenerated: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type { PackItemInput } from './input';

export type Weight = {
  value: number;
  unit: string;
};

export interface PackItemCategory {
  items: number;
  name: string;
  weight: Weight;
  percentage: number;
}

export interface Pack {
  id: string;
  name: string;
  description?: string | null;
  category: PackCategory;
  userId?: number;
  templateId?: string | null;
  isPublic: boolean;
  image?: string | null;
  tags?: string[] | null;
  categories?: string[]; // For compatibility with some API responses
  items: PackItem[];
  baseWeight: number;
  totalWeight: number;
  deleted: boolean;
  localCreatedAt?: string;
  localUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PackWeightHistoryEntry = {
  id: string;
  packId: string;
  weight: number;
  createdAt?: string;
  localCreatedAt?: string;
};

export type PackInStore = Omit<Pack, 'items' | 'baseWeight' | 'totalWeight'>;

export type PackInput = Omit<
  PackInStore,
  'id' | 'userId' | 'deleted' | 'createdAt' | 'updatedAt' | 'localCreatedAt' | 'localUpdatedAt'
>;
