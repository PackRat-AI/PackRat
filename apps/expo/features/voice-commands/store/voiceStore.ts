import { observable } from '@legendapp/state';

export type VoicePhase =
  | 'idle'
  | 'listening'
  | 'working'
  /** Waiting on a spoken yes or no. */
  | 'confirming'
  | 'answering';

/**
 * What the trip page's voice bar shows: the phase, what PackRat heard, what it's doing about it,
 * then what it said. One command runs at a time, for the trip on screen.
 */
export const voiceStore = observable<{
  phase: VoicePhase;
  heard: string;
  status: string;
  answer: string;
}>({
  phase: 'idle',
  heard: '',
  status: '',
  answer: '',
});
