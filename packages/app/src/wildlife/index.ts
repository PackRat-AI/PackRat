export {
  getSpeciesByCategory,
  getSpeciesById,
  SPECIES_DATABASE,
  searchSpecies,
} from './data/speciesDatabase';
export {
  getAllSpeciesResults,
  getCandidatesByCategory,
  getDangerousSpecies,
  identifyFromDescription,
} from './lib/offlineIdentifier';
export type {
  IdentificationResult,
  SpeciesCategory,
  SpeciesEntry,
  WildlifeIdentification,
} from './types';
