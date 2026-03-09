import * as FileSystem from 'expo-file-system';

/** Directory where offline map tile data is stored */
export const OFFLINE_MAPS_DIR = `${FileSystem.documentDirectory}offline-maps/`;

/** Primary teal color used for offline map region highlights */
export const REGION_TEAL_COLOR = '#14b8a6';

/** Fill color (teal at 15% opacity) for region polygon overlays */
export const REGION_FILL_COLOR = 'rgba(20,184,166,0.15)';
