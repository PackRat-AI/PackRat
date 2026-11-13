import * as Sentry from '@sentry/react-native';
import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  type ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import { speakable, VoiceAnswers } from '../utils/voiceAnswers';
import { pauseWakeWord } from './wakeWord';

/** Why listening ended without a transcript, said back to the user. */
export class VoiceListenError extends Error {
  constructor(readonly spoken: string) {
    super(spoken);
    this.name = 'VoiceListenError';
  }
}

export type ListenMode =
  /** Push to talk: listens until `stopListening`. */
  | 'untilStopped'
  /** Hands-free, for a yes or no: listens until the user goes quiet. */
  | 'untilSilence';

const LANGUAGE = 'en-US';

/** Silence that ends a hands-free answer, and the most a user gets to start one. */
const SILENCE_MS = 1_500;
const HANDS_FREE_LIMIT_MS = 8_000;

let recognizerOptions: Promise<Partial<ExpoSpeechRecognitionOptions>> | null = null;

/**
 * Recognition stays on the phone: the on-device recogniser when the phone has the English model,
 * otherwise the default one asked to prefer offline. Worked out once per launch.
 */
function onDeviceOptions(): Promise<Partial<ExpoSpeechRecognitionOptions>> {
  recognizerOptions ??= (async () => {
    try {
      if (ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
        const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
        if (installedLocales.some((locale) => locale.toLowerCase().startsWith('en'))) {
          return { requiresOnDeviceRecognition: true };
        }
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'voiceCommands', action: 'onDeviceCheck' },
      });
    }
    return { androidIntentOptions: { EXTRA_PREFER_OFFLINE: true } };
  })();
  return recognizerOptions;
}

export async function hasVoicePermission(): Promise<boolean> {
  const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  return granted;
}

export async function requestVoicePermission(): Promise<boolean> {
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return granted;
}

/** Errors that mean "nothing was said", which ends listening quietly rather than as a failure. */
const SILENT_ERRORS: readonly ExpoSpeechRecognitionErrorCode[] = Object.freeze([
  'no-speech',
  'speech-timeout',
  'aborted',
]);

/**
 * One listen at a time. Resolves with what was heard, an empty string for silence, and rejects
 * with a `VoiceListenError` whose text can be said back.
 */
export function listen({
  mode,
  onPartial,
}: {
  mode: ListenMode;
  onPartial: (text: string) => void;
}): Promise<string> {
  cancelListening();
  pauseWakeWord();
  return new Promise((resolve, reject) => {
    let transcript = '';
    let settled = false;
    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const text = event.results[0]?.transcript ?? '';
        if (!text) return;
        transcript = text;
        onPartial(text);
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        if (SILENT_ERRORS.includes(event.error)) return finish(() => resolve(transcript));
        if (event.error === 'not-allowed') {
          return finish(() => reject(new VoiceListenError(VoiceAnswers.microphoneDenied)));
        }
        Sentry.captureException(new Error(`Speech recognition failed: ${event.error}`), {
          tags: { feature: 'voiceCommands', action: 'listen' },
          extra: { errorCode: event.error, message: event.message },
        });
        finish(() => reject(new VoiceListenError(VoiceAnswers.listenFailed)));
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => finish(() => resolve(transcript))),
    ];
    const limit =
      mode === 'untilSilence'
        ? setTimeout(() => ExpoSpeechRecognitionModule.stop(), HANDS_FREE_LIMIT_MS)
        : null;

    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      if (limit) clearTimeout(limit);
      for (const subscription of subscriptions) subscription.remove();
      activeAbort = null;
      settle();
    }
    activeAbort = () => finish(() => resolve(''));

    void onDeviceOptions().then((options) => {
      if (settled) return;
      ExpoSpeechRecognitionModule.start({
        lang: LANGUAGE,
        interimResults: true,
        // Push to talk keeps listening through pauses until the button comes up.
        continuous: mode === 'untilStopped',
        addsPunctuation: false,
        ...options,
        androidIntentOptions: {
          ...options.androidIntentOptions,
          ...(mode === 'untilSilence'
            ? { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_MS }
            : {}),
        },
      });
    });
  });
}

let activeAbort: (() => void) | null = null;

/** The button came up: stop and keep what was heard. */
export function stopListening(): void {
  ExpoSpeechRecognitionModule.stop();
}

/** Drop the current listen without a result. */
export function cancelListening(): void {
  if (!activeAbort) return;
  activeAbort();
  ExpoSpeechRecognitionModule.abort();
}

// ── Tones ─────────────────────────────────────────────────────────────────

export type VoiceTone = 'start' | 'end';

/** Android's stock record start and stop sounds (AOSP, Apache 2.0), the ones users already know. */
const TONE_SOURCES = Object.freeze({
  start: require('expo-app/assets/sounds/voice-start.wav'),
  end: require('expo-app/assets/sounds/voice-end.wav'),
} as const);

/** Long enough for the start tone to finish before the microphone opens, so it isn't heard. */
const START_TONE_MS = 500;

const tonePlayers: Partial<Record<VoiceTone, AudioPlayer>> = {};

function tonePlayer(tone: VoiceTone): AudioPlayer {
  tonePlayers[tone] ??= createAudioPlayer(TONE_SOURCES[tone]);
  return tonePlayers[tone];
}

/** The short chime that marks the microphone opening or closing. */
export async function playTone(tone: VoiceTone): Promise<void> {
  try {
    const player = tonePlayer(tone);
    await player.seekTo(0);
    player.play();
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'voiceCommands', action: 'tone' } });
    return;
  }
  if (tone === 'start') await new Promise((resolve) => setTimeout(resolve, START_TONE_MS));
}

/** Loads the tones, the voice and the recogniser choice ahead of the first press. */
export function warmUpVoice(): void {
  tonePlayer('start');
  tonePlayer('end');
  void bestVoice();
  void onDeviceOptions();
}

// ── Speaking ──────────────────────────────────────────────────────────────

let chosenVoice: Promise<string | undefined> | null = null;

/**
 * The most natural English voice on the phone that works offline: enhanced before standard, the
 * phone's region before US English. Network voices are skipped so answers never stall without
 * signal.
 */
function bestVoice(): Promise<string | undefined> {
  chosenVoice ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[1];
      const offline = voices.filter(
        (voice) => voice.language.startsWith('en') && !voice.identifier.includes('network'),
      );
      const score = (voice: Speech.Voice) =>
        (voice.quality === Speech.VoiceQuality.Enhanced ? 4 : 0) +
        (region && voice.language.endsWith(region) ? 2 : 0) +
        (voice.language === LANGUAGE ? 1 : 0);
      const [best] = offline.sort((a, b) => score(b) - score(a));
      return best?.identifier;
    })
    .catch(() => undefined);
  return chosenVoice;
}

/** Says `text` and resolves once it's been said, stopped or failed. */
export async function say(text: string): Promise<void> {
  const voice = await bestVoice();
  await new Promise<void>((resolve) => {
    Speech.speak(speakable(text), {
      language: LANGUAGE,
      voice,
      onDone: resolve,
      onStopped: resolve,
      onError: (error) => {
        Sentry.captureException(error, { tags: { feature: 'voiceCommands', action: 'speak' } });
        resolve();
      },
    });
  });
}

export function stopSpeaking(): void {
  void Speech.stop();
}
