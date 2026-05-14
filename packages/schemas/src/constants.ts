import { z } from 'zod';

export {
  AVAILABILITY_VALUES,
  type Availability,
  ITEM_CATEGORIES,
  type ItemCategory,
  type ItemLink,
  type ItemReview,
  PACK_CATEGORIES,
  type PackCategory,
  WEIGHT_UNITS,
  type WeightUnit,
} from '@packrat/constants';

import {
  AVAILABILITY_VALUES,
  ITEM_CATEGORIES,
  PACK_CATEGORIES,
  WEIGHT_UNITS,
} from '@packrat/constants';

export const PackCategorySchema = z.enum(PACK_CATEGORIES);
export const ItemCategorySchema = z.enum(ITEM_CATEGORIES);
export const WeightUnitSchema = z.enum(WEIGHT_UNITS);
export const AvailabilitySchema = z.enum(AVAILABILITY_VALUES);
