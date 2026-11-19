import { describe, expect, it } from 'vitest';
import {
  commandAfterWakePhrase,
  needsConfirmation,
  normalizeTranscript,
  parseVoiceCommand,
  parseVoiceConfirmation,
  type VoiceCommand,
} from '../voiceCommand';

describe('parseVoiceCommand', () => {
  it.each<[string, VoiceCommand]>([
    ['Check in', { kind: 'checkIn' }],
    ['send a check-in', { kind: 'checkIn' }],
    ["Let them know I'm OK", { kind: 'checkIn' }],
    ["I'm safe", { kind: 'imSafe' }],
    ['I’m back', { kind: 'imSafe' }],
    ['end my trip', { kind: 'imSafe' }],
    ['Start my trip', { kind: 'startTrip' }],
    ['Where am I?', { kind: 'whereAmI' }],
    ['How far to go', { kind: 'howFarToGo' }],
    ['how much further', { kind: 'howFarToGo' }],
    ['Am I on route?', { kind: 'amIOnRoute' }],
    ['am I off track', { kind: 'amIOnRoute' }],
    ['When am I due back', { kind: 'whenAmIDue' }],
    ["What's the weather", { kind: 'weather' }],
    ['is it going to rain', { kind: 'weather' }],
  ])('reads "%s" as a trip command', (transcript, expected) => {
    expect(parseVoiceCommand(transcript)).toEqual(expected);
  });

  it.each<[string, number]>([
    ['Add an hour', 60],
    ['add two hours', 120],
    ['Add 30 minutes', 30],
    ['extend by an hour and a half', 90],
    ['give me half an hour', 30],
    ['add half hour', 30],
    ['give me another 15 mins', 15],
    ["I'm running late", 60],
    ['add 30 hours', 24 * 60],
    ['add twenty five minutes', 25],
  ])('reads "%s" as %i more minutes', (transcript, minutes) => {
    expect(parseVoiceCommand(transcript)).toEqual({ kind: 'extendBy', minutes });
  });

  it('reads a return time of day as this evening unless said otherwise', () => {
    expect(parseVoiceCommand("I'll be back at eight")).toEqual({
      kind: 'extendUntil',
      hour: 20,
      minute: 0,
    });
    expect(parseVoiceCommand('back by 7:30')).toEqual({
      kind: 'extendUntil',
      hour: 19,
      minute: 30,
    });
    expect(parseVoiceCommand("I'll be back at seven forty five")).toEqual({
      kind: 'extendUntil',
      hour: 19,
      minute: 45,
    });
    expect(parseVoiceCommand('back at 9 am')).toEqual({ kind: 'extendUntil', hour: 9, minute: 0 });
    expect(parseVoiceCommand('back at 12 a.m.')).toEqual({
      kind: 'extendUntil',
      hour: 0,
      minute: 0,
    });
    expect(parseVoiceCommand('back by 21:15')).toEqual({
      kind: 'extendUntil',
      hour: 21,
      minute: 15,
    });
    expect(parseVoiceCommand("back at eight o'clock tonight")).toEqual({
      kind: 'extendUntil',
      hour: 20,
      minute: 0,
    });
    expect(parseVoiceCommand('back at eight in the morning')).toEqual({
      kind: 'extendUntil',
      hour: 8,
      minute: 0,
    });
  });

  it('never acts on a negated instruction, but keeps it in a note', () => {
    expect(parseVoiceCommand("don't stop recording")).toBeNull();
    expect(parseVoiceCommand('do not check in')).toBeNull();
    expect(parseVoiceCommand("note: don't stop recording")).toEqual({
      kind: 'note',
      text: "Don't stop recording",
    });
  });

  it('does not read an unspoken time as a return time', () => {
    expect(parseVoiceCommand('back at the car')).toBeNull();
    expect(parseVoiceCommand('back at 30')).toBeNull();
  });

  it('never sends anything on a guess', () => {
    expect(parseVoiceCommand('')).toBeNull();
    expect(parseVoiceCommand('   ...')).toBeNull();
    expect(parseVoiceCommand('what a view')).toBeNull();
    expect(parseVoiceCommand('chicken')).toBeNull();
    expect(parseVoiceCommand('my address')).toBeNull();
    expect(parseVoiceCommand('add')).toBeNull();
  });

  it.each<[string, VoiceCommand]>([
    ['Start tracking', { kind: 'startTracking' }],
    ['start recording', { kind: 'startTracking' }],
    ['track my hike', { kind: 'startTracking' }],
    ['track me', { kind: 'startTracking' }],
    ['Pause tracking', { kind: 'pauseTracking' }],
    ['pause', { kind: 'pauseTracking' }],
    ['resume tracking', { kind: 'resumeTracking' }],
    ['resume', { kind: 'resumeTracking' }],
    ['continue recording', { kind: 'resumeTracking' }],
    ['Stop tracking', { kind: 'stopTracking' }],
    ['end recording', { kind: 'stopTracking' }],
    ['How far have I gone?', { kind: 'trackSoFar' }],
    ['how far have I hiked', { kind: 'trackSoFar' }],
  ])('reads "%s" as a tracking command', (transcript, expected) => {
    expect(parseVoiceCommand(transcript)).toEqual(expected);
  });

  it('tells how far have I gone apart from how far to go', () => {
    expect(parseVoiceCommand('how far have I gone')).toEqual({ kind: 'trackSoFar' });
    expect(parseVoiceCommand('how far to go')).toEqual({ kind: 'howFarToGo' });
  });

  it.each<[string, string | null]>([
    ['Mark waypoint', null],
    ['mark a waypoint here', null],
    ['Mark waypoint water source', 'Water source'],
    ['drop a pin called camp', 'Camp'],
    ['add a waypoint named the bridge', 'The bridge'],
  ])('names the waypoint in "%s"', (transcript, name) => {
    expect(parseVoiceCommand(transcript)).toEqual({ kind: 'markWaypoint', name });
  });

  it("keeps a note in the user's own words, even ones that sound like commands", () => {
    expect(parseVoiceCommand('Note: trail washed out past the bridge')).toEqual({
      kind: 'note',
      text: 'Trail washed out past the bridge',
    });
    expect(parseVoiceCommand("take a note I'm safe at the lake")).toEqual({
      kind: 'note',
      text: "I'm safe at the lake",
    });
    expect(parseVoiceCommand('note')).toEqual({ kind: 'note', text: '' });
    expect(parseVoiceCommand('notebook')).toBeNull();
  });

  it('starts and stops navigation', () => {
    expect(parseVoiceCommand('Navigate to camp')).toEqual({ kind: 'navigate', to: 'camp' });
    expect(parseVoiceCommand('take me back to the car')).toEqual({
      kind: 'navigate',
      to: 'the car',
    });
    expect(parseVoiceCommand('stop navigating to camp')).toEqual({ kind: 'stopNavigating' });
    expect(parseVoiceCommand('how far to go to camp')).toEqual({ kind: 'howFarToGo' });
  });
});

describe('needsConfirmation', () => {
  it('asks for a spoken yes only before telling other people something', () => {
    expect(needsConfirmation({ kind: 'checkIn' })).toBe(true);
    expect(needsConfirmation({ kind: 'imSafe' })).toBe(true);
    expect(needsConfirmation({ kind: 'extendBy', minutes: 60 })).toBe(true);
    expect(needsConfirmation({ kind: 'extendUntil', hour: 20, minute: 0 })).toBe(true);
    expect(needsConfirmation({ kind: 'whereAmI' })).toBe(false);
    expect(needsConfirmation({ kind: 'weather' })).toBe(false);
    expect(needsConfirmation({ kind: 'markWaypoint', name: null })).toBe(false);
  });
});

describe('parseVoiceConfirmation', () => {
  it('lets any no win over a yes', () => {
    expect(parseVoiceConfirmation('Yes')).toBe('yes');
    expect(parseVoiceConfirmation('yeah send it')).toBe('yes');
    expect(parseVoiceConfirmation('confirm')).toBe('yes');
    expect(parseVoiceConfirmation('No')).toBe('no');
    expect(parseVoiceConfirmation("don't send it")).toBe('no');
    expect(parseVoiceConfirmation('cancel')).toBe('no');
    expect(parseVoiceConfirmation("yes, I'm not sure")).toBe('no');
    expect(parseVoiceConfirmation('I never said yes')).toBe('no');
    expect(parseVoiceConfirmation("I didn't say yes")).toBe('no');
    expect(parseVoiceConfirmation('')).toBeNull();
    expect(parseVoiceConfirmation('hmm')).toBeNull();
  });
});

describe('normalizeTranscript', () => {
  it('drops punctuation and splits clock times', () => {
    expect(normalizeTranscript("  I'll be BACK at 7:30 p.m.! ")).toBe('ill be back at 7 30 pm');
    expect(normalizeTranscript('send a check-in')).toBe('send a check in');
  });
});

describe('commandAfterWakePhrase', () => {
  it('finds the command said after the last Hey PackRat', () => {
    expect(commandAfterWakePhrase('Hey PackRat, where am I?')).toBe('where am i');
    expect(commandAfterWakePhrase('hey pack rat')).toBe('');
    expect(commandAfterWakePhrase('ok packrat check in hey packrat weather')).toBe('weather');
    expect(commandAfterWakePhrase('what a view')).toBeNull();
  });
});
