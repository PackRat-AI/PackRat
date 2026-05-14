import {
  AVAILABILITY_VALUES,
  ITEM_CATEGORIES,
  PACK_CATEGORIES,
  WEIGHT_UNITS,
} from '@packrat/constants';
import { z } from 'zod';

export const PackCategorySchema = z.enum(PACK_CATEGORIES);
export const ItemCategorySchema = z.enum(ITEM_CATEGORIES);
export const WeightUnitSchema = z.enum(WEIGHT_UNITS);
export const AvailabilitySchema = z.enum(AVAILABILITY_VALUES);
