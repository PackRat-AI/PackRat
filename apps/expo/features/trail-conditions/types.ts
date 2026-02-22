export interface TrailCondition {
  id: string;
  userId: string;
  trailId?: string;
  trailName: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  surfaceCondition?: 'paved' | 'gravel' | 'dirt' | 'rocky' | 'snow' | 'mud';
  difficulty?: number;
  hasFallenTrees?: boolean;
  hasWildlife?: boolean;
  hasErosion?: boolean;
  hasClosures?: boolean;
  hasWaterCrossings?: boolean;
  waterCrossingCount?: number;
  waterDepth?: 'shallow' | 'moderate' | 'deep';
  waterDifficulty?: 'easy' | 'moderate' | 'difficult';
  photoUrls?: string[];
  notes?: string;
  trustScore?: number;
  verifiedCount?: number;
  isOffline?: boolean;
  syncedAt?: string;
  reportedAt: string;
  updatedAt: string;
}

export interface TrailConditionVerification {
  id: string;
  conditionId: string;
  userId: string;
  isAccurate: boolean;
  notes?: string;
  createdAt: string;
}

export interface CreateTrailConditionRequest {
  trailId?: string;
  trailName: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  surfaceCondition?: string;
  difficulty?: number;
  hasFallenTrees?: boolean;
  hasWildlife?: boolean;
  hasErosion?: boolean;
  hasClosures?: boolean;
  hasWaterCrossings?: boolean;
  waterCrossingCount?: number;
  waterDepth?: string;
  waterDifficulty?: string;
  photoUrls?: string[];
  notes?: string;
}
