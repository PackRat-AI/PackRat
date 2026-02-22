export { NatureLensScreen } from './screens/NatureLensScreen';
export { IdentificationCard } from './components/IdentificationCard';
export { ConfidenceBadge } from './components/ConfidenceBadge';
export { SafetyBadge } from './components/SafetyBadge';
export { 
  useNatureIdentifications, 
  useIdentifyImage, 
  useDeleteIdentification 
} from './hooks/useNatureLens';
export type { NatureIdentification, IdentifyImageRequest, IdentifyImageResponse } from './types';
