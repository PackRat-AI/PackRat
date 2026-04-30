import type { NewCatalogItem } from '@packrat/api/db/schema';
import type { ValidatedCatalogItem, ValidationError } from '@packrat/api/types/etl';
import { isNumber, isString } from '@packrat/guards';

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

    if (!item.weight || !isNumber(item.weight) || item.weight <= 0) {
      errors.push({
        field: 'weight',
        reason: 'Weight is required and must be a positive number',
        value: item.weight,
      });
    }

    if (!item.weightUnit || !isString(item.weightUnit) || item.weightUnit.trim().length === 0) {
      errors.push({
        field: 'weightUnit',
        reason: 'Weight unit is required and must be a non-empty string',
        value: item.weightUnit,
      });
    }

    // Additional validations
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
