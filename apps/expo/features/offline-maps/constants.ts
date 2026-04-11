import { documentDirectory } from 'expo-file-system/legacy';

/** Directory where offline map tile data is stored */
export const OFFLINE_MAPS_DIR = `${documentDirectory}offline-maps/`;

/** Primary teal color used for offline map region highlights */
export const REGION_TEAL_COLOR = '#14b8a6';

/** Fill color (teal at 15% opacity) for region polygon overlays */
export const REGION_FILL_COLOR = 'rgba(20,184,166,0.15)';

/** Error thrown when a region with the same ID is already downloading */
export const ERR_DUPLICATE_DOWNLOAD = 'duplicate_download';

/** Error thrown when there is insufficient device storage to begin a download */
export const ERR_INSUFFICIENT_STORAGE = 'insufficient_storage';
