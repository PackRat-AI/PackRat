export type TrailSurface = 'paved' | 'gravel' | 'dirt' | 'rocky' | 'snow' | 'mud';
export type OverallCondition = 'excellent' | 'good' | 'fair' | 'poor';
export type WaterCrossingDifficulty = 'easy' | 'moderate' | 'difficult';

export interface TrailConditionReport {
  id: string;
  trailName: string;
  trailRegion?: string | null;
  surface: TrailSurface;
  overallCondition: OverallCondition;
  hazards: string[];
  waterCrossings: number;
  waterCrossingDifficulty?: WaterCrossingDifficulty | null;
  notes?: string | null;
  photos: string[];
  userId?: number;
  tripId?: string | null;
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
  localCreatedAt?: string;
  localUpdatedAt?: string;
}

export type TrailConditionReportInStore = Omit<TrailConditionReport, 'userId'>;

export type TrailConditionReportInput = Omit<
  TrailConditionReport,
  'id' | 'userId' | 'deleted' | 'createdAt' | 'updatedAt' | 'localCreatedAt' | 'localUpdatedAt'
>;
