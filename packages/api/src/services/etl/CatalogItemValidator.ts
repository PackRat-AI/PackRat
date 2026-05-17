import type { ValidatedCatalogItem } from '@packrat/api/types/etl';
import type { NewCatalogItem } from '@packrat/db';
import { isNumber, isString } from '@packrat/guards';
import type { ValidationError } from '@packrat/schemas/validation';

export class CatalogItemValidator {
  validateItem(item: Partial<NewCatalogItem>): ValidatedCatalogItem {
    const errors: ValidationError[] = [];

    // Required field validations
    if (!item.name || !isString(item.name) || item.name.trim().length === 0) {
      errors.push({
        field: 'name',
        reason: 'Name is required and must be a non-empty string',
        value: item.name,
      });
    }

    if (!item.sku || !isString(item.sku) || item.sku.trim().length === 0) {
      errors.push({
        field: 'sku',
        reason: 'SKU is required and must be a non-empty string',
        value: item.sku,
      });
    }

    if (!item.productUrl || !isString(item.productUrl) || item.productUrl.trim().length === 0) {
      errors.push({
        field: 'productUrl',
        reason: 'Product URL is required and must be a non-empty string',
        value: item.productUrl,
      });
    }

    // Additional validations
    // Note: weight and weightUnit are intentionally not required — clothing/footwear brands often
    // omit weight data. Items without weight are ingested but won't appear in weight comparisons.
    if (item.productUrl && !this.isValidUrl(item.productUrl)) {
      errors.push({
        field: 'productUrl',
        reason: 'Product URL must be a valid URL format',
        value: item.productUrl,
      });
    }

    if (item.price !== undefined && (!isNumber(item.price) || item.price < 0)) {
      errors.push({
        field: 'price',
        reason: 'Price must be a non-negative number',
        value: item.price,
      });
    }

    return {
      item,
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
