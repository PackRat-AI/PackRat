import type { NewCatalogItem } from '@packrat/api/db/schema';

export interface ValidationError {
  field: string;
  reason: string;
  value?: any;
}

export interface InvalidItemLog {
  importId: string;
  errors: ValidationError[];
  rawData: Record<string, any>;
  timestamp: number;
  rowIndex: number;
}

export interface ValidatedCatalogItem {
  item: Partial<NewCatalogItem>;
  isValid: boolean;
  errors: ValidationError[];
  rowIndex: number;
}
