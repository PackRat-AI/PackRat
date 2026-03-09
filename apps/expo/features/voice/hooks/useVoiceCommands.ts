import { useCallback, useRef, useState } from 'react';
import type { VoiceCommand, VoiceCommandName, VoiceListeningState } from '../types';
import { useGPSTracking } from './useGPSTracking';
import { useSpeech } from './useSpeech';

/**
 * Registered voice commands with their trigger patterns.
 * Pattern matching is case-insensitive substring match,
 * enabling future integration with any speech-to-text backend
 * (Vosk, Picovoice, Whisper, Web Speech API, etc.).
 */
const VOICE_COMMANDS: VoiceCommand[] = [
  {
    name: 'start_tracking',
    patterns: ['start tracking', 'begin tracking', 'start gps', 'track me'],
    description: 'Begin GPS location tracking',
  },
  {
    name: 'stop_tracking',
    patterns: ['stop tracking', 'end tracking', 'stop gps', 'pause tracking'],
    description: 'End GPS location tracking',
  },
  {
    name: 'mark_waypoint',
    patterns: ['mark waypoint', 'save location', 'add waypoint', 'mark location', 'drop pin'],
    description: 'Create a waypoint at the current location',
  },
  {
    name: 'where_am_i',
    patterns: ['where am i', "what's my location", 'my location', 'current location'],
    description: 'Announce current GPS coordinates',
  },
  {
    name: 'how_far',
    patterns: [
      'how far',
      'distance to',
      'how far to destination',
      'distance remaining',
      'how much further',
    ],
    description: 'Announce distance to last waypoint',
  },
  {
    name: 'navigate_to',
    patterns: ['navigate to', 'go to', 'take me to', 'directions to'],
    description: 'Start navigation to a named waypoint',
  },
];

/**
 * Match a transcript against registered command patterns.
 */
function matchCommand(transcript: string): VoiceCommand | null {
  const lower = transcript.toLowerCase().trim();
  for (const cmd of VOICE_COMMANDS) {
    if (cmd.patterns.some((p) => lower.includes(p))) {
      return cmd;
    }
  }
  return null;
}

/**
 * Format metres into a human-readable distance string.
 */
function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres)} meters`;
  }
  return `${(metres / 1000).toFixed(1)} kilometers`;
}

/**
 * Main hook that wires together voice recognition, GPS tracking, and TTS.
 *
 * Voice input is accepted via the `processTranscript` function, which lets
 * any speech-to-text backend (Vosk, Picovoice, Web Speech API, etc.) feed
 * recognised text into the command pipeline.
 *
 * The `startListening` / `stopListening` lifecycle hooks are provided so UI
 * components can trigger recording on button press – the actual microphone
 * work is delegated to the chosen STT integration.
 */
export function useVoiceCommands() {
  const { speak } = useSpeech();
  const gps = useGPSTracking();

  const [listeningState, setListeningState] = useState<VoiceListeningState>('idle');
  const [lastCommand, setLastCommand] = useState<VoiceCommandName | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Called by a speech-to-text backend with the recognised text. */
  const processTranscript = useCallback(
    async (transcript: string) => {
      setLastTranscript(transcript);
      setListeningState('processing');

      const command = matchCommand(transcript);
      if (!command) {
        speak("I didn't recognise that command. Please try again.");
        setListeningState('idle');
        return;
      }

      setLastCommand(command.name);

      switch (command.name) {
        case 'start_tracking': {
          const started = await gps.startTracking();
          speak(started ? 'GPS tracking started.' : 'Unable to start tracking. Check permissions.');
          break;
        }

        case 'stop_tracking': {
          gps.stopTracking();
          speak('GPS tracking stopped.');
          break;
        }

        case 'mark_waypoint': {
          const waypoint = await gps.markWaypoint();
          if (waypoint) {
            speak(`Waypoint ${waypoint.name} marked at your current location.`);
          } else {
            speak('Unable to mark waypoint. GPS position not available.');
          }
          break;
        }

        case 'where_am_i': {
          const pos = gps.currentPosition ?? (await gps.getCurrentPosition());
          if (pos) {
            speak(
              `You are at latitude ${pos.latitude.toFixed(4)}, longitude ${pos.longitude.toFixed(4)}.`,
            );
          } else {
            speak('Unable to determine your location. Check GPS permissions.');
          }
          break;
        }

        case 'how_far': {
          const lastWaypoint = gps.waypoints[gps.waypoints.length - 1];
          if (!lastWaypoint) {
            speak('No waypoints saved. Mark a waypoint first.');
          } else {
            const dist = gps.getDistanceTo(lastWaypoint);
            if (dist !== null) {
              speak(`You are ${formatDistance(dist)} from ${lastWaypoint.name}.`);
            } else {
              speak('Unable to calculate distance. GPS position not available.');
            }
          }
          break;
        }

        case 'navigate_to': {
          const target = transcript.toLowerCase().replace(/navigate to|go to|take me to|directions to/g, '').trim();
          const found = gps.waypoints.find((w) => w.name.toLowerCase().includes(target));
          if (found) {
            const dist = gps.getDistanceTo(found);
            if (dist !== null) {
              speak(
                `Navigating to ${found.name}. Distance is ${formatDistance(dist)}.`,
              );
            } else {
              speak(`Navigating to ${found.name}.`);
            }
          } else {
            speak(
              target
                ? `Waypoint "${target}" not found. Try marking it first.`
                : 'Please say the waypoint name after "navigate to".',
            );
          }
          break;
        }
      }

      setListeningState('idle');
    },
    [speak, gps],
  );

  /** Called when user presses the microphone button to start recording. */
  const startListening = useCallback(() => {
    setListeningState('listening');
    setErrorMessage(null);

    // Auto-timeout after 10 seconds if no transcript arrives
    listeningTimeoutRef.current = setTimeout(() => {
      setListeningState('idle');
    }, 10000);
  }, []);

  /** Called when user releases the microphone button or recording ends. */
  const stopListening = useCallback(() => {
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
    }
    if (listeningState === 'listening') {
      setListeningState('idle');
    }
  }, [listeningState]);

  return {
    // State
    listeningState,
    lastCommand,
    lastTranscript,
    errorMessage,

    // GPS state passthrough
    isTracking: gps.isTracking,
    currentPosition: gps.currentPosition,
    waypoints: gps.waypoints,

    // Actions
    startListening,
    stopListening,
    processTranscript,

    // Available commands reference
    availableCommands: VOICE_COMMANDS,
  };
}
