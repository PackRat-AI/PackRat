import { describe, expect, it } from 'vitest';
import {
  CatalogSortField,
  CrossingDifficulty,
  ExperienceLevel,
  ItemCategory,
  PackCategory,
  PackStyle,
  SortOrder,
  TrailCondition,
  TrailSurface,
  WeightPriority,
} from '../enums';

describe('PackCategory', () => {
  it('maps all expected categories to their string values', () => {
    expect(PackCategory.Backpacking).toBe('backpacking');
    expect(PackCategory.Camping).toBe('camping');
    expect(PackCategory.Climbing).toBe('climbing');
    expect(PackCategory.Custom).toBe('custom');
    expect(PackCategory.Desert).toBe('desert');
    expect(PackCategory.Hiking).toBe('hiking');
    expect(PackCategory.Skiing).toBe('skiing');
    expect(PackCategory.WaterSports).toBe('water sports');
    expect(PackCategory.Winter).toBe('winter');
  });

  it('has 9 members', () => {
    const values = Object.values(PackCategory);
    expect(values).toHaveLength(9);
  });
});

describe('ItemCategory', () => {
  it('maps all expected item categories to their string values', () => {
    expect(ItemCategory.Clothing).toBe('clothing');
    expect(ItemCategory.Shelter).toBe('shelter');
    expect(ItemCategory.Sleep).toBe('sleep');
    expect(ItemCategory.Kitchen).toBe('kitchen');
    expect(ItemCategory.Water).toBe('water');
    expect(ItemCategory.Electronics).toBe('electronics');
    expect(ItemCategory.FirstAid).toBe('first-aid');
    expect(ItemCategory.Navigation).toBe('navigation');
    expect(ItemCategory.Tools).toBe('tools');
    expect(ItemCategory.Consumables).toBe('consumables');
    expect(ItemCategory.Miscellaneous).toBe('miscellaneous');
  });

  it('has 11 members', () => {
    expect(Object.values(ItemCategory)).toHaveLength(11);
  });
});

describe('TrailSurface', () => {
  it('maps all expected trail surfaces to their string values', () => {
    expect(TrailSurface.Paved).toBe('paved');
    expect(TrailSurface.Gravel).toBe('gravel');
    expect(TrailSurface.Dirt).toBe('dirt');
    expect(TrailSurface.Rocky).toBe('rocky');
    expect(TrailSurface.Snow).toBe('snow');
    expect(TrailSurface.Mud).toBe('mud');
  });
});

describe('TrailCondition', () => {
  it('maps all expected conditions to their string values', () => {
    expect(TrailCondition.Excellent).toBe('excellent');
    expect(TrailCondition.Good).toBe('good');
    expect(TrailCondition.Fair).toBe('fair');
    expect(TrailCondition.Poor).toBe('poor');
  });
});

describe('CrossingDifficulty', () => {
  it('maps all expected difficulties to their string values', () => {
    expect(CrossingDifficulty.Easy).toBe('easy');
    expect(CrossingDifficulty.Moderate).toBe('moderate');
    expect(CrossingDifficulty.Difficult).toBe('difficult');
  });
});

describe('SortOrder', () => {
  it('has ascending and descending variants', () => {
    expect(SortOrder.Asc).toBe('asc');
    expect(SortOrder.Desc).toBe('desc');
  });
});

describe('ExperienceLevel', () => {
  it('maps all experience levels to their string values', () => {
    expect(ExperienceLevel.Beginner).toBe('beginner');
    expect(ExperienceLevel.Intermediate).toBe('intermediate');
    expect(ExperienceLevel.Advanced).toBe('advanced');
  });
});

describe('PackStyle', () => {
  it('maps all pack styles to their string values', () => {
    expect(PackStyle.Ultralight).toBe('ultralight');
    expect(PackStyle.Lightweight).toBe('lightweight');
    expect(PackStyle.Traditional).toBe('traditional');
  });
});

describe('WeightPriority', () => {
  it('maps all weight priorities to their string values', () => {
    expect(WeightPriority.Ultralight).toBe('ultralight');
    expect(WeightPriority.WeightConscious).toBe('weight-conscious');
    expect(WeightPriority.DurabilityFirst).toBe('durability-first');
  });
});

describe('CatalogSortField', () => {
  it('maps all sort fields to their string values', () => {
    expect(CatalogSortField.Name).toBe('name');
    expect(CatalogSortField.Brand).toBe('brand');
    expect(CatalogSortField.Price).toBe('price');
    expect(CatalogSortField.Rating).toBe('ratingValue');
    expect(CatalogSortField.CreatedAt).toBe('createdAt');
    expect(CatalogSortField.UpdatedAt).toBe('updatedAt');
    expect(CatalogSortField.Usage).toBe('usage');
  });

  it('has 7 members', () => {
    expect(Object.values(CatalogSortField)).toHaveLength(7);
  });
});
