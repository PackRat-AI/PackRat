import { describe, expect, it } from 'vitest';
import {
  buildChecklists,
  type Checklist,
  HOW_TO_RECORD,
  mergeByPlatform,
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
    expect(lists[0].items.map((i) => i.section)).toEqual(['Fake — Ask AI', 'Fake — Start Packing']);
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

  it('records the subsection each item came from, prefixed by its plan', () => {
    const lists = parsePlan(PLATFORM_SPLIT_PLAN, PLATFORM_CONFIG);

    // The plan label rides along so sections stay distinct once several
    // plans are merged into one platform issue.
    expect(lists[0].items[0].section).toBe('Fake — Signing in');
    expect(lists[1].items[0].section).toBe('Fake — Windows');
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
    sources: ['docs/qa/fake.md'],
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

  it('opens on the recording rule, then the first section heading', () => {
    const body = renderBody(macList);

    expect(body.startsWith(`${HOW_TO_RECORD}\n\n### Windows\n`)).toBe(true);
  });

  it('says to check a box on a pass and open an issue on a failure', () => {
    const body = renderBody(macList);

    expect(body).toContain('Check a box if it passed for you.');
    expect(body).toContain('Open an issue if it doesn’t');
    expect(body).toContain('leave the box ticked if it was checked already');
  });

  it('states the recording rule once, not per section', () => {
    const body = renderBody(macList);

    expect(body.split(HOW_TO_RECORD)).toHaveLength(2);
  });

  it('ends on the last checkbox, with no reporting footer', () => {
    const body = renderBody(macList);

    expect(body.trimEnd().endsWith('- [ ] Press Escape.')).toBe(true);
    expect(body).not.toContain('Reports go to GitHub issues');
    expect(body).not.toContain('merely annoying');
    expect(body).not.toContain('---');
  });

  it('carries no metadata block — the title holds the platform', () => {
    const body = renderBody(macList);

    expect(body).not.toContain('**Platform:**');
    expect(body).not.toContain('**OS version:**');
    expect(body).not.toContain('**Tester:**');
  });

  it('is nothing but the recording rule, headings and checkboxes', () => {
    const body = renderBody(macList);
    const shapes = body
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) =>
        l === HOW_TO_RECORD
          ? 'rule'
          : l.startsWith('### ')
            ? 'heading'
            : l.startsWith('- [ ] ')
              ? 'checkbox'
              : l,
      );

    expect(new Set(shapes)).toEqual(new Set(['rule', 'heading', 'checkbox']));
  });

  it('keeps the watch body as bare as any other platform', () => {
    const body = renderBody({ ...macList, platform: 'Apple Watch' });

    expect(body).not.toContain('Digital Crown');
    expect(body.startsWith(`${HOW_TO_RECORD}\n\n### Windows\n`)).toBe(true);
  });
});

describe('mergeByPlatform', () => {
  /** Two plans, both touching iPhone and Mac. */
  const perPlan: Checklist[] = [
    {
      title: '[QA] Apple platforms — iPhone',
      platform: 'iPhone',
      sources: ['apple.md'],
      items: [{ section: 'Apple platforms — Packs', text: 'Create a pack.' }],
    },
    {
      title: '[QA] Apple platforms — Mac',
      platform: 'Mac',
      sources: ['apple.md'],
      items: [{ section: 'Apple platforms — Windows', text: 'Open a second window.' }],
    },
    {
      title: '[QA] Pack tools — iPhone',
      platform: 'iPhone',
      sources: ['tools.md'],
      items: [{ section: 'Pack tools — Ask AI', text: 'Open Ask AI.' }],
    },
    {
      title: '[QA] Pack tools — Mac',
      platform: 'Mac',
      sources: ['tools.md'],
      items: [{ section: 'Pack tools — Mac', text: 'Resize the window.' }],
    },
  ];

  it('produces one checklist per platform, not per plan', () => {
    const merged = mergeByPlatform(perPlan);

    expect(merged).toHaveLength(2);
    expect(merged.map((l) => l.platform)).toEqual(['iPhone', 'Mac']);
  });

  it('titles the merged checklist by platform alone', () => {
    const merged = mergeByPlatform(perPlan);

    expect(merged.map((l) => l.title)).toEqual(['[QA] iPhone', '[QA] Mac']);
  });

  it('concatenates every plan’s items for that platform', () => {
    const merged = mergeByPlatform(perPlan);

    expect(merged[0].items.map((i) => i.text)).toEqual(['Create a pack.', 'Open Ask AI.']);
    expect(merged[1].items.map((i) => i.text)).toEqual([
      'Open a second window.',
      'Resize the window.',
    ]);
  });

  it('loses no items in the merge', () => {
    const merged = mergeByPlatform(perPlan);
    const before = perPlan.reduce((sum, l) => sum + l.items.length, 0);
    const after = merged.reduce((sum, l) => sum + l.items.length, 0);

    expect(after).toBe(before);
  });

  it('keeps plan-prefixed sections distinct rather than folding them', () => {
    const body = renderBody(mergeByPlatform(perPlan)[1]);

    expect(body).toContain('### Apple platforms — Windows');
    expect(body).toContain('### Pack tools — Mac');
  });

  it('records every source plan it merged, without duplicates', () => {
    const merged = mergeByPlatform(perPlan);

    expect(merged[0].sources).toEqual(['apple.md', 'tools.md']);
    expect(mergeByPlatform([perPlan[0], perPlan[0]])[0].sources).toEqual(['apple.md']);
  });

  it('does not mutate the checklists handed to it', () => {
    mergeByPlatform(perPlan);

    expect(perPlan[0].items).toHaveLength(1);
    expect(perPlan[0].sources).toEqual(['apple.md']);
  });

  it('passes a single-platform set straight through, retitled', () => {
    const merged = mergeByPlatform([perPlan[0]]);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('[QA] iPhone');
    expect(merged[0].items).toHaveLength(1);
  });
});

describe('renderGate', () => {
  const lists: Checklist[] = [
    {
      title: '[QA] A — iPhone',
      platform: 'iPhone',
      sources: ['a.md'],
      items: [{ section: 's', text: 't' }],
    },
    {
      title: '[QA] A — Mac',
      platform: 'Mac',
      sources: ['a.md'],
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

    expect(sections).toContain('Pack tools — Ask AI');
    expect(sections).toContain('Pack tools — Add from Catalog');
    expect(sections).toContain('Pack tools — Scan Items from Photo');
    expect(sections).toContain('Pack tools — Start Packing');
  });

  it('throws on an unknown plan rather than generating an empty checklist', () => {
    expect(() => buildChecklists('nope')).toThrow(/Unknown plan "nope"/);
  });
});
