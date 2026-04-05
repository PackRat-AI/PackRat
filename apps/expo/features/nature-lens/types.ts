export interface NatureIdentification {
  id: string;
  userId: string;
  imageUrl?: string;
  imageLocalPath?: string;
  speciesName: string;
  speciesCommonName?: string;
  confidence: number;
  category: 'plant' | 'animal' | 'bird' | 'insect' | 'fungus' | 'other';
  description?: string;
  habitat?: string;
  isEdible?: boolean;
  isDangerous?: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  isOffline?: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdentifyImageRequest {
  imageUrl?: string;
  imageBase64?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

export interface IdentifyImageResponse {
  identification: NatureIdentification;
}
