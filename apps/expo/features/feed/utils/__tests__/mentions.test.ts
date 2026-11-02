import { describe, expect, it } from 'vitest';
import type { PostAuthor } from '../../types';
import {
  activeMentionQuery,
  displayName,
  initials,
  insertMention,
  mentionSegments,
  taggedPeopleIn,
  taggedSummary,
} from '../mentions';

const ann: PostAuthor = { id: 'u1', firstName: 'Ann', lastName: 'Lee' };
const annie: PostAuthor = { id: 'u4', firstName: 'Ann', lastName: null };
const ben: PostAuthor = { id: 'u2', firstName: 'Ben', lastName: 'Ortiz' };
const cy: PostAuthor = { id: 'u3', firstName: null, lastName: 'Cy' };

describe('displayName / initials', () => {
  it('joins the parts that exist', () => {
    expect(displayName(ann)).toBe('Ann Lee');
    expect(displayName(cy)).toBe('Cy');
    expect(initials(ann)).toBe('AL');
    expect(initials(cy)).toBe('C');
  });

  it('falls back when the person has no name', () => {
    expect(displayName({ firstName: null, lastName: '  ' })).toBe('PackRat member');
    expect(initials({ firstName: null, lastName: null })).toBe('');
  });
});

describe('activeMentionQuery', () => {
  it('finds a query typed at the end after a space or at the start', () => {
    expect(activeMentionQuery('hi @an')).toEqual({ atIndex: 3, query: 'an' });
    expect(activeMentionQuery('@Ann L')).toEqual({ atIndex: 0, query: 'Ann L' });
  });

  it('ignores an @ inside a word, a bare @, and closed queries', () => {
    expect(activeMentionQuery('mail me@host')).toBeNull();
    expect(activeMentionQuery('hello @')).toBeNull();
    expect(activeMentionQuery('hello')).toBeNull();
    expect(activeMentionQuery('@Ann Lee ')).toBeNull();
    expect(activeMentionQuery('@Ann\nnext')).toBeNull();
    expect(activeMentionQuery('@one two three four')).toBeNull();
    expect(activeMentionQuery(`@${'x'.repeat(41)}`)).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the active query with the full name and a trailing space', () => {
    expect(insertMention('with @an', ann)).toBe('with @Ann Lee ');
  });

  it('leaves the text alone when no query is active', () => {
    expect(insertMention('no query', ann)).toBe('no query');
  });
});

describe('taggedPeopleIn', () => {
  it('keeps picked people whose name is still in the text, once each', () => {
    const text = 'with @Ann Lee and @Ann Lee again';
    expect(taggedPeopleIn(text, [ann, ben, ann]).map((p) => p.id)).toEqual(['u1']);
  });
});

describe('mentionSegments', () => {
  it('marks tagged names and prefers the longer match', () => {
    expect(mentionSegments('hi @Ann Lee and @Ann!', [annie, ann])).toEqual([
      { text: 'hi ' },
      { text: '@Ann Lee', person: ann },
      { text: ' and ' },
      { text: '@Ann', person: annie },
      { text: '!' },
    ]);
  });

  it('returns the text whole when nobody is tagged, and nothing for empty text', () => {
    expect(mentionSegments('@Ann Lee', [])).toEqual([{ text: '@Ann Lee' }]);
    expect(mentionSegments('', [ann])).toEqual([]);
    expect(mentionSegments('', [])).toEqual([]);
  });

  it('handles text that is only a mention', () => {
    expect(mentionSegments('@Ben Ortiz', [ben])).toEqual([{ text: '@Ben Ortiz', person: ben }]);
  });
});

describe('taggedSummary', () => {
  it('names one, two, or the first and a count', () => {
    expect(taggedSummary([])).toBeNull();
    expect(taggedSummary([ann])).toBe('Ann Lee');
    expect(taggedSummary([ann, ben])).toBe('Ann Lee and Ben Ortiz');
    expect(taggedSummary([ann, ben, cy])).toBe('Ann Lee and 2 others');
  });
});
