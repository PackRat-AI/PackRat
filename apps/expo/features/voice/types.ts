export type VoiceCommandName =
  | 'start_tracking'
  | 'stop_tracking'
  | 'mark_waypoint'
  | 'where_am_i'
  | 'how_far'
  | 'navigate_to';

export interface VoiceCommand {
  name: VoiceCommandName;
  patterns: string[];
  description: string;
}

export interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export type VoiceListeningState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceCommandsState {
  listeningState: VoiceListeningState;
  lastCommand: VoiceCommandName | null;
  lastTranscript: string;
  isTracking: boolean;
  currentPosition: GPSPosition | null;
  waypoints: Waypoint[];
  errorMessage: string | null;
}
