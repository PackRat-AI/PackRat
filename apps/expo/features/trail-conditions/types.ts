export type TrailConditionValue = 'excellent' | 'good' | 'fair' | 'poor' | 'closed';

export interface TrailConditionLocation {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface TrailCondition {
  id: string;
  userId: number;
  trailName: string;
  location?: TrailConditionLocation | null;
  condition: TrailConditionValue;
  details: string;
  photos?: string[] | null;
  trustScore: number;
  verifiedCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TrailConditionInput = Omit<
  TrailCondition,
  'id' | 'userId' | 'trustScore' | 'verifiedCount' | 'helpfulCount' | 'createdAt' | 'updatedAt'
> & {
  id: string;
};
