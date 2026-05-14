import type { NewCatalogItem } from '@packrat/db';
import type { ValidationError } from '@packrat/schemas/validation';

export interface ValidatedCatalogItem {
  item: Partial<NewCatalogItem>;
  isValid: boolean;
  errors: ValidationError[];
}
