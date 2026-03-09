export type SpeciesCategory =
  | 'plant'
  | 'tree'
  | 'animal'
  | 'bird'
  | 'insect'
  | 'mushroom'
  | 'reptile'
  | 'fish';

export type EdibilityStatus = 'edible' | 'poisonous' | 'unknown' | 'medicinal';

export interface SpeciesIdentification {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  category: SpeciesCategory;
  confidence: number;
  imageUri: string;
  identifiedAt: string;
  habitat?: string;
  edibility?: EdibilityStatus;
  region?: string;
  conservationStatus?: string;
  funFact?: string;
}

export interface IdentificationResult {
  species: SpeciesIdentification[];
  isOffline: boolean;
  processingTimeMs: number;
}

export interface WildlifeHistoryEntry extends SpeciesIdentification {
  notes?: string;
}
