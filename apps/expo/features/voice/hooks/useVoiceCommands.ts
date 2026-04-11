import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceCommand, VoiceCommandName, VoiceListeningState } from '../types';
import { useGPSTracking } from './useGPSTracking';
import { useSpeech } from './useSpeech';

/**
 * Registered voice commands with their trigger patterns.
 * Pattern matching is case-insensitive substring match,
 * enabling future integration with any speech-to-text backend
 * (Vosk, Picovoice, Whisper, Web Speech API, etc.).
 */
export const VOICE_COMMANDS: VoiceCommand[] = [
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
    patterns: ['where am i', "what's my location", 'current location'],
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

/** Ordered longest-first so longer prefixes match before shorter ones (e.g. "directions to" before "go to"). */
const NAVIGATE_TO_PREFIXES = ['directions to', 'navigate to', 'take me to', 'go to'] as const;

/**
 * Match a transcript against registered command patterns.
 * Exported for testing purposes.
 */
export function matchCommand(transcript: string): VoiceCommand | null {
  const lower = transcript.toLowerCase().trim();
  for (const cmd of VOICE_COMMANDS) {
    if (cmd.patterns.some((p) => lower.includes(p))) {
      return cmd;
    }
  }
  return null;
}

/**
 * Extract the destination noun phrase from a navigate_to transcript.
 * Strips the first matching command prefix for reliable extraction (#8).
 * Exported for testing purposes.
 */
export function extractNavigationTarget(transcript: string): string {
  const lower = transcript.toLowerCase();
  for (const prefix of NAVIGATE_TO_PREFIXES) {
    const idx = lower.indexOf(prefix);
    if (idx !== -1) {
      return transcript.slice(idx + prefix.length).trim();
    }
  }
  return transcript.trim();
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
 * components can trigger recording on button press — the actual microphone
 * work is delegated to the chosen STT integration.
 */
export function useVoiceCommands() {
  const { speak } = useSpeech();

  // Destructure only the values we need so that useCallback deps are stable (#2)
  const {
    startTracking,
    stopTracking,
    markWaypoint,
    getCurrentPosition,
    getDistanceTo,
    currentPosition,
    waypoints,
    isTracking,
  } = useGPSTracking();

  const [listeningState, setListeningState] = useState<VoiceListeningState>('idle');
  const [lastCommand, setLastCommand] = useState<VoiceCommandName | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // Stable ref so startListening's timeout can call stopListening without a dep
  const stopListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Clear the auto-timeout and any active recording when the hook unmounts (#4)
  useEffect(() => {
    return () => {
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  /** Called by a speech-to-text backend with the recognised text. */
  const processTranscript = useCallback(
    async (transcript: string) => {
      // Cancel the auto-timeout so it doesn't fire after command processing (#3)
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = null;
      }
      setLastTranscript(transcript);
      setListeningState('processing');

      const command = matchCommand(transcript);
      if (!command) {
        speak("I didn't recognise that command. Please try again.");
        setListeningState('error');
        return;
      }

      setLastCommand(command.name);

      try {
        switch (command.name) {
          case 'start_tracking': {
            const started = await startTracking();
            if (!started) {
              speak('Unable to start tracking. Check permissions.');
              setListeningState('error');
              return;
            }
            speak('GPS tracking started.');
            break;
          }

          case 'stop_tracking': {
            stopTracking();
            speak('GPS tracking stopped.');
            break;
          }

          case 'mark_waypoint': {
            const waypoint = await markWaypoint();
            if (waypoint) {
              speak(`Waypoint ${waypoint.name} marked at your current location.`);
            } else {
              speak('Unable to mark waypoint. GPS position not available.');
              setListeningState('error');
              return;
            }
            break;
          }

          case 'where_am_i': {
            const pos = currentPosition ?? (await getCurrentPosition());
            if (pos) {
              speak(
                `You are at latitude ${pos.latitude.toFixed(4)}, longitude ${pos.longitude.toFixed(4)}.`,
              );
            } else {
              speak('Unable to determine your location. Check GPS permissions.');
              setListeningState('error');
              return;
            }
            break;
          }

          case 'how_far': {
            const lastWaypoint = waypoints[waypoints.length - 1];
            if (!lastWaypoint) {
              speak('No waypoints saved. Mark a waypoint first.');
            } else {
              const dist = getDistanceTo(lastWaypoint);
              if (dist !== null) {
                speak(`You are ${formatDistance(dist)} from ${lastWaypoint.name}.`);
              } else {
                speak('Unable to calculate distance. GPS position not available.');
                setListeningState('error');
                return;
              }
            }
            break;
          }

          case 'navigate_to': {
            const target = extractNavigationTarget(transcript);
            const found = waypoints.find((w) =>
              w.name.toLowerCase().includes(target.toLowerCase()),
            );
            if (found) {
              const dist = getDistanceTo(found);
              if (dist !== null) {
                speak(`Navigating to ${found.name}. Distance is ${formatDistance(dist)}.`);
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
      } catch {
        speak('An error occurred while processing your command.');
        setListeningState('error');
        return;
      }

      setListeningState('idle');
    },
    [
      speak,
      startTracking,
      stopTracking,
      markWaypoint,
      getCurrentPosition,
      getDistanceTo,
      currentPosition,
      waypoints,
    ],
  );

  /** Called when user presses the microphone button to start recording. */
  const startListening = useCallback(async () => {
    // Bail out if already recording to avoid a second subscription (#3 pattern)
    if (recordingRef.current) return;

    // Clear any previously scheduled timeout before starting a new one
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }

    try {
      // Request mic permission and configure the audio session
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        speak('Microphone permission is required for voice commands.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
    } catch (err) {
      console.warn('[useVoiceCommands] Failed to start recording:', err);
      speak('Unable to start microphone. Please try again.');
      return;
    }

    setListeningState('listening');

    // Auto-timeout after 10 seconds if no transcript arrives
    listeningTimeoutRef.current = setTimeout(() => {
      stopListeningRef.current?.();
      speak('Listening timed out. Please try again.');
    }, 10000);
  }, [speak]);

  /** Called when user releases the microphone button or recording ends. */
  const stopListening = useCallback(async () => {
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    // Use functional update to avoid stale closure on listeningState (#5)
    setListeningState((prev) => (prev === 'listening' ? 'idle' : prev));

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        // The URI of the recorded audio file (for STT transcription)
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;

        // TODO: wire to real STT backend (e.g., OpenAI Whisper, Google Speech-to-Text)
        // Send `uri` to the STT service and call processTranscript() with the result.
        // Example: const transcript = await transcribeAudio(uri);
        //          if (transcript) processTranscript(transcript);
        console.debug('[useVoiceCommands] Recording saved to:', uri);
      } catch (err) {
        console.warn('[useVoiceCommands] Failed to stop recording:', err);
        recordingRef.current = null;
      }
    }
  }, []);
  // Keep ref in sync so startListening's timeout can call stopListening without a circular dep
  stopListeningRef.current = stopListening;

  return {
    // State
    listeningState,
    lastCommand,
    lastTranscript,

    // GPS state passthrough
    isTracking,
    currentPosition,
    waypoints,

    // Actions
    startListening,
    stopListening,
    processTranscript,

    // Available commands reference
    availableCommands: VOICE_COMMANDS,
  };
}
