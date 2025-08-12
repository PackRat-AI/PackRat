import type { NewCatalogItem } from '@packrat/api/db/schema';

export interface ValidationError {
  field: string;
  reason: string;
  value?: string | number | boolean | null | undefined;
}

export interface ValidatedCatalogItem {
  item: Partial<NewCatalogItem>;
  isValid: boolean;
  errors: ValidationError[];
}
