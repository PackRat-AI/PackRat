import { SPECIES_DATABASE, searchSpecies } from '../data/speciesDatabase';
import type { IdentificationResult, SpeciesEntry } from '../types';

/**
 * Attempt to identify a species from a text description when offline.
 * This performs keyword matching against the local species database.
 */
export function identifyFromDescription(description: string): IdentificationResult[] {
  if (!description.trim()) return [];

  const matches = searchSpecies(description);
  return matches.slice(0, 5).map((species, index) => ({
    species,
    confidence: Math.max(0.1, 0.6 - index * 0.1),
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
