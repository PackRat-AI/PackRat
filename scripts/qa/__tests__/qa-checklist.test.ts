import { describe, expect, it } from 'vitest';
import {
  buildChecklists,
  type Checklist,
  parsePlan,
  renderBody,
  renderGate,
} from '../qa-checklist';

/** Mirrors the apple-platforms shape: `##` headings are the platforms. */
const PLATFORM_SPLIT_PLAN = `# Guide

## Before you start

- Note your OS version.

## iPhone

### Signing in

- Create a new account.
- Sign out and sign back in. Expect your packs and trips to all come back
  rather than leaving you with empty screens.

## Mac

### Windows

- Open a second window with Cmd-N.

## Reporting

- Reports go to GitHub issues.
`;

/** Mirrors the pack-tools shape: `##` are features, one trailing `## Mac`. */
const FEATURE_SPLIT_PLAN = `# Guide

## Before you start

- Sign in first.

## Ask AI

- Open Ask AI on a pack with gear in it.

## Start Packing

- Tap two or three items.

## Mac

- Resize the window narrow, then stretch it wide.
`;

const PLATFORM_CONFIG = {
  file: 'docs/qa/fake.md',
  label: 'Fake',
  splitAt: ['iPhone', 'Mac'],
} as const;

const FEATURE_CONFIG = {
  file: 'docs/qa/fake.md',
  label: 'Fake',
  splitAt: ['Mac'],
  leadPlatform: 'iPhone',
} as const;

describe('parsePlan', () => {
  it('splits a platform-shaped plan into one checklist per platform', () => {
    const lists = parsePlan(PLATFORM_SPLIT_PLAN, PLATFORM_CONFIG);

    expect(lists.map((l) => l.platform)).toEqual(['iPhone', 'Mac']);
    expect(lists[0].items).toHaveLength(2);
    expect(lists[1].items).toHaveLength(1);
  });

  it('assigns feature sections to the lead platform and splits at Mac', () => {
    const lists = parsePlan(FEATURE_SPLIT_PLAN, FEATURE_CONFIG);

    expect(lists.map((l) => l.platform)).toEqual(['iPhone', 'Mac']);
    // Both feature sections land on iPhone; only the Mac bullet on Mac.
    expect(lists[0].items.map((i) => i.section)).toEqual(['Ask AI', 'Start Packing']);
    expect(lists[1].items).toHaveLength(1);
    expect(lists[1].items[0].text).toBe('Resize the window narrow, then stretch it wide.');
  });

  it('folds a bullet that wraps across lines into one item', () => {
    const lists = parsePlan(PLATFORM_SPLIT_PLAN, PLATFORM_CONFIG);

    expect(lists[0].items[1].text).toBe(
      'Sign out and sign back in. Expect your packs and trips to all come back rather than leaving you with empty screens.',
    );
  });

  it('skips setup and reporting bullets, which are not test items', () => {
    const lists = parsePlan(PLATFORM_SPLIT_PLAN, PLATFORM_CONFIG);
    const allText = lists.flatMap((l) => l.items).map((i) => i.text);

    expect(allText).not.toContain('Note your OS version.');
    expect(allText).not.toContain('Reports go to GitHub issues.');
  });

  it('records the subsection each item came from, for grouping', () => {
    const lists = parsePlan(PLATFORM_SPLIT_PLAN, PLATFORM_CONFIG);

    expect(lists[0].items[0].section).toBe('Signing in');
    expect(lists[1].items[0].section).toBe('Windows');
  });

  it('titles each checklist with the plan label and platform', () => {
    const lists = parsePlan(PLATFORM_SPLIT_PLAN, PLATFORM_CONFIG);

    expect(lists.map((l) => l.title)).toEqual(['[QA] Fake — iPhone', '[QA] Fake — Mac']);
  });
});

describe('renderBody', () => {
  const macList: Checklist = {
    title: '[QA] Fake — Mac',
    platform: 'Mac',
    source: 'docs/qa/fake.md',
    items: [
      { section: 'Windows', text: 'Open a second window.' },
      { section: 'Windows', text: 'Close the last window.' },
      { section: 'Keyboard', text: 'Press Escape.' },
    ],
  };

  it('renders one unticked checkbox per item, verbatim', () => {
    const body = renderBody(macList);

    expect(body).toContain('- [ ] Open a second window.');
    expect(body).toContain('- [ ] Close the last window.');
    expect(body).toContain('- [ ] Press Escape.');
    expect(body).not.toContain('- [x]');
  });

  it('groups items under their section heading, without repeating it', () => {
    const body = renderBody(macList);

    expect(body.match(/^### Windows$/gm)).toHaveLength(1);
    expect(body.match(/^### Keyboard$/gm)).toHaveLength(1);
  });

  it('leaves a blank line before a heading that follows a checkbox list', () => {
    const body = renderBody(macList);

    expect(body).toContain('- [ ] Close the last window.\n\n### Keyboard');
  });

  it('asks for platform and OS attribution', () => {
    const body = renderBody(macList);

    expect(body).toContain('**Platform:** Mac');
    expect(body).toContain('**OS version:**');
    expect(body).toContain('**Tester:**');
  });

  it('opens on the attribution fields, with no prose preamble', () => {
    const body = renderBody(macList);

    expect(body.startsWith('**Platform:** Mac\n')).toBe(true);
  });

  it('ends on the last checkbox, with no reporting footer', () => {
    const body = renderBody(macList);

    expect(body.trimEnd().endsWith('- [ ] Press Escape.')).toBe(true);
    expect(body).not.toContain('Reports go to GitHub issues');
    expect(body).not.toContain('merely annoying');
    expect(body).not.toContain('---');
  });

  it('keeps the watch body as bare as any other platform', () => {
    const body = renderBody({ ...macList, platform: 'Apple Watch' });

    expect(body).not.toContain('Digital Crown');
    expect(body).toContain('**Platform:** Apple Watch');
  });
});

describe('renderGate', () => {
  const lists: Checklist[] = [
    {
      title: '[QA] A — iPhone',
      platform: 'iPhone',
      source: 'a.md',
      items: [{ section: 's', text: 't' }],
    },
    {
      title: '[QA] A — Mac',
      platform: 'Mac',
      source: 'a.md',
      items: [
        { section: 's', text: 't' },
        { section: 's', text: 'u' },
      ],
    },
  ];

  it('references the created issues by number when they exist', () => {
    const gate = renderGate(lists, [101, 102]);

    expect(gate).toContain('- [ ] #101 — 1 items');
    expect(gate).toContain('- [ ] #102 — 2 items');
  });

  it('falls back to titles when no issues have been created yet', () => {
    const gate = renderGate(lists, []);

    expect(gate).toContain('[QA] A — iPhone');
    expect(gate).not.toContain('#101');
  });

  it('totals the items across every checklist', () => {
    const gate = renderGate(lists, [1, 2]);

    expect(gate).toContain('3 test items across 2 platform checklists');
  });

  it('makes an open ReleaseBlocker override the tick count', () => {
    const gate = renderGate(lists, [1, 2]);

    expect(gate).toContain('ReleaseBlocker');
    expect(gate).toContain('we do not ship');
  });
});

describe('buildChecklists', () => {
  it('parses the real pack-tools plan into an iPhone and a Mac checklist', () => {
    const lists = buildChecklists('pack-tools');

    expect(lists.map((l) => l.platform)).toEqual(['iPhone', 'Mac']);
    expect(lists[0].items.length).toBeGreaterThan(40);
    expect(lists[1].items.length).toBeGreaterThan(5);
  });

  it('parses the real apple-platforms plan into all three platforms', () => {
    const lists = buildChecklists('apple-platforms');

    expect(lists.map((l) => l.platform)).toEqual(['iPhone', 'Mac', 'Apple Watch']);
  });

  it('covers the four pack tools in the iPhone checklist sections', () => {
    const sections = new Set(buildChecklists('pack-tools')[0].items.map((i) => i.section));

    expect(sections).toContain('Ask AI');
    expect(sections).toContain('Add from Catalog');
    expect(sections).toContain('Scan Items from Photo');
    expect(sections).toContain('Start Packing');
  });

  it('throws on an unknown plan rather than generating an empty checklist', () => {
    expect(() => buildChecklists('nope')).toThrow(/Unknown plan "nope"/);
  });
});
