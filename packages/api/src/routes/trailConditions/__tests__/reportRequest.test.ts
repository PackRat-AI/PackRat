import {
  CreateTrailConditionReportRequestSchema,
  UpdateTrailConditionReportRequestSchema,
} from '@packrat/schemas/trailConditions';
import { describe, expect, it } from 'vitest';

const base = {
  id: 'r1',
  trailName: 'Half Dome Trail',
  surface: 'dirt',
  overallCondition: 'good',
  localCreatedAt: '2026-10-08T10:00:00.000Z',
  localUpdatedAt: '2026-10-08T10:00:00.000Z',
};
const TRAIL_ID = 'fe63954f-386b-4251-9d28-0a11ad044bc3';

const issues = (input: unknown) => {
  const result = CreateTrailConditionReportRequestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('CreateTrailConditionReportRequestSchema', () => {
  it('accepts a picked trail with the place it was written', () => {
    expect(issues({ ...base, trailId: TRAIL_ID, latitude: 37.7, longitude: -119.5 })).toEqual([]);
  });

  it('accepts a picked trail without a location', () => {
    expect(issues({ ...base, trailId: TRAIL_ID })).toEqual([]);
  });

  it('accepts a dropped pin with a label and no trail', () => {
    expect(
      issues({ ...base, trailName: 'Unnamed spur', latitude: 37.7, longitude: -119.5 }),
    ).toEqual([]);
  });

  it('rejects a typed name with neither a trail nor a pin', () => {
    expect(issues(base)).toEqual(['Pick a trail or drop a pin']);
  });

  it('rejects half a coordinate', () => {
    expect(issues({ ...base, trailId: TRAIL_ID, latitude: 37.7 })).toEqual([
      'latitude and longitude go together',
    ]);
  });

  it('rejects a trail id that is not a trail-table uuid', () => {
    expect(issues({ ...base, trailId: 'Half Dome' })).toHaveLength(1);
  });

  it('accepts up to five photos', () => {
    const photos = ['a', 'b', 'c', 'd', 'e'].map((k) => `user-${k}.jpg`);
    expect(issues({ ...base, trailId: TRAIL_ID, photos })).toEqual([]);
  });

  it('rejects a sixth photo', () => {
    const photos = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => `user-${k}.jpg`);
    const result = CreateTrailConditionReportRequestSchema.safeParse({
      ...base,
      trailId: TRAIL_ID,
      photos,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['photos']);
  });
});

describe('UpdateTrailConditionReportRequestSchema', () => {
  it('drops the trail and place, which a report keeps for life', () => {
    const parsed = UpdateTrailConditionReportRequestSchema.parse({
      notes: 'Cables down',
      trailId: TRAIL_ID,
      latitude: 1,
      longitude: 2,
    });
    expect(parsed).toEqual({ notes: 'Cables down' });
  });
});
