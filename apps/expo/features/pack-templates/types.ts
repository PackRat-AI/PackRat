export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';

export interface PackWeightHistoryEntry {
  id: string;
  packId: string;
  weight: number;
  localCreatedAt: string;
}

export interface PackTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  userId?: number;
  isAppTemplate: boolean;
  image?: string;
  tags?: string[];
  items: PackTemplateItem[];
  baseWeight: number;
  totalWeight: number;
  deleted: boolean;
  localCreatedAt: string;
  localUpdatedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PackTemplateItem {
  id: string;
  packTemplateId: string;
  name: string;
  description?: string;
  weight: number;
  weightUnit: WeightUnit;
  quantity: number;
  category?: string;
  consumable: boolean;
  worn: boolean;
  image?: string | null;
  notes?: string;
  catalogItemId?: number;
  userId?: number;
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PackTemplateItemInput {
  name: string;
  description?: string;
  weight: number;
  weightUnit: WeightUnit;
  quantity: number;
  category?: string;
  consumable: boolean;
  worn: boolean;
  notes?: string;
  image?: string | null;
  catalogItemId?: string;
}

export type PackTemplateInStore = Omit<PackTemplate, 'items' | 'baseWeight' | 'totalWeight'>;

export type PackTemplateInput = Omit<
  PackTemplateInStore,
  'id' | 'userId' | 'deleted' | 'createdAt' | 'updatedAt' | 'localCreatedAt' | 'localUpdatedAt'
>;
