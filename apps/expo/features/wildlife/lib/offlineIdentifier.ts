import { SPECIES_DATABASE, searchSpecies } from '../data/speciesDatabase';
import type { IdentificationResult, SpeciesEntry } from '../types';

const MIN_CONFIDENCE = 0.1;
const BASE_CONFIDENCE = 0.6;
const CONFIDENCE_DECAY = 0.1;

/**
 * Attempt to identify a species from a text description when offline.
 * This performs keyword matching against the local species database.
 */
export function identifyFromDescription(description: string): IdentificationResult[] {
  const query = description.trim();
  const matches = searchSpecies(query);
  return matches.slice(0, 5).map((species, index) => ({
    species,
    confidence: Math.max(MIN_CONFIDENCE, BASE_CONFIDENCE - index * CONFIDENCE_DECAY),
    source: 'offline' as const,
  }));
}

/**
 * Get candidate species based on category filter for offline browsing.
 */
export function getCandidatesByCategory(category: string): IdentificationResult[] {
  const matches = SPECIES_DATABASE.filter((s) => s.category === category);
  return matches.map((species) => ({
    species,
    confidence: 0,
    source: 'offline' as const,
  }));
}

/**
 * Get all dangerous species from the local database.
 */
export function getDangerousSpecies(): SpeciesEntry[] {
  return SPECIES_DATABASE.filter((s) => s.dangerLevel === 'dangerous');
}

/**
 * Return all species as low-confidence offline results (for browsing mode).
 */
export function getAllSpeciesResults(): IdentificationResult[] {
  return SPECIES_DATABASE.map((species) => ({
    species,
    confidence: 0,
    source: 'offline' as const,
  }));
}
