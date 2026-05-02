export type SpeciesCategory =
  | 'mammal'
  | 'bird'
  | 'reptile'
  | 'amphibian'
  | 'insect'
  | 'plant'
  | 'flower'
  | 'tree'
  | 'mushroom'
  | 'fish'
  | 'other';

export interface SpeciesEntry {
  id: string;
  commonName: string;
  scientificName: string;
  category: SpeciesCategory;
  description: string;
  habitat: string[];
  regions: string[];
  dangerLevel: 'safe' | 'caution' | 'dangerous';
  characteristics: string[];
  conservationStatus?: string;
  interestingFacts?: string[];
  imageDescription?: string;
}

export interface IdentificationResult {
  species: SpeciesEntry;
  /** Normalized confidence score in the range [0, 1]. */
  confidence: number;
  source: 'online' | 'offline';
}

export interface WildlifeIdentification {
  id: string;
  imageUri: string;
  timestamp: number;
  results: IdentificationResult[];
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}
