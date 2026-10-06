import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const duplicateRows: unknown[][] = [];
  const ownerRows: unknown[][] = [];
  const templateReturning = vi.fn();
  const itemReturning = vi.fn();
  const templateValues = vi.fn((_v: unknown) => ({ returning: templateReturning }));
  const itemValues = vi.fn((_v: unknown) => ({ returning: itemReturning }));
  let insertCount = 0;
  const tx = {
    insert: vi.fn(() => {
      insertCount += 1;
      return { values: insertCount % 2 === 1 ? templateValues : itemValues };
    }),
  };
  return {
    duplicateRows,
    ownerRows,
    templateReturning,
    itemReturning,
    templateValues,
    itemValues,
    tx,
    resetInsertCount: () => {
      insertCount = 0;
    },
    fetchTranscript: vi.fn(),
    containerFetch: vi.fn(),
    generateObject: vi.fn(),
    batchVectorSearch: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: () => ({
          from: () => ({
            where: () => ({
              // duplicate check: .where().limit()
              limit: () => Promise.resolve(duplicateRows.shift() ?? []),
              // owner lookup: .where().orderBy().limit()
              orderBy: () => ({ limit: () => Promise.resolve(ownerRows.shift() ?? []) }),
            }),
          }),
        }),
        transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/services/catalogService', () => ({
  CatalogService: class {
    batchVectorSearch = mocks.batchVectorSearch;
  },
}));
vi.mock('@packrat/api/utils/ai/provider', () => ({
  createGoogleAIProvider: () => (model: string) => ({ model }),
}));
vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: () => ({ APP_CONTAINER: {} }) }));
vi.mock('@packrat/api/utils/queryMetrics', () => ({ setQueryTag: vi.fn() }));
vi.mock('@packrat/db/schema', () => ({
  packTemplates: { contentSource: 'cs', contentId: 'cid', deleted: 'deleted', id: 'id' },
  packTemplateItems: {},
  users: { id: 'id', role: 'role' },
}));
vi.mock('@packrat/schemas/packTemplates', () => ({ AIPackAnalysisSchema: {} }));
vi.mock('youtube-transcript', () => ({ fetchTranscript: mocks.fetchTranscript }));
vi.mock('@cloudflare/containers', () => ({
  getContainer: () => ({ fetch: mocks.containerFetch }),
}));
vi.mock('ai', () => ({ generateObject: mocks.generateObject }));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...a) => ({ and: a })),
  asc: vi.fn((c) => ({ asc: c })),
  eq: vi.fn((c, v) => ({ eq: [c, v] })),
}));

import {
  classifyImportError,
  getYouTubeId,
  importPackTemplateFromOnlineContent,
  isYouTubeUrl,
  resolveAppTemplateOwnerId,
} from '../packTemplateImportService';

const analysis = {
  templateName: 'Alpine Weekend',
  templateCategory: 'hiking',
  templateDescription: 'Two days above treeline',
  items: [
    {
      name: 'Tent',
      description: 'Two person',
      quantity: 1,
      category: 'shelter',
      weightGrams: 1200,
      consumable: false,
      worn: false,
    },
    {
      name: 'Gels',
      description: '',
      quantity: 4,
      category: 'food',
      weightGrams: 40,
      consumable: true,
      worn: false,
    },
  ],
};
const created = { id: 'pt_x', name: 'Alpine Weekend' };
const youtube = 'https://www.youtube.com/watch?v=abc123';
const tiktok = 'https://www.tiktok.com/@hiker/video/42';
const args = (contentUrl: string) => ({ contentUrl, ownerUserId: 'admin_1', isAppTemplate: false });

function tiktokResponse(data: Record<string, unknown>, ok = true) {
  return {
    ok,
    status: ok ? 200 : 502,
    text: () => Promise.resolve('bad gateway'),
    json: () => Promise.resolve({ success: true, data }),
  };
}

describe('URL helpers', () => {
  it('recognises YouTube hosts', () => {
    expect(isYouTubeUrl('https://youtu.be/abc')).toBe(true);
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isYouTubeUrl(tiktok)).toBe(false);
    expect(isYouTubeUrl('not a url')).toBe(false);
  });

  it('extracts YouTube ids from both URL shapes', () => {
    expect(getYouTubeId('https://youtu.be/abc')).toBe('abc');
    expect(getYouTubeId('https://youtube.com/watch?v=xyz')).toBe('xyz');
    expect(getYouTubeId(tiktok)).toBeNull();
    expect(getYouTubeId('nope')).toBeNull();
  });
});

describe('classifyImportError()', () => {
  it.each([
    [new Error('Gemini quota exceeded'), 'AI_ANALYSIS_ERROR'],
    [new Error('catalog lookup failed'), 'CATALOG_SEARCH_ERROR'],
    [new Error('database timeout'), 'DATABASE_ERROR'],
    [new Error('something else'), 'UNKNOWN_ERROR'],
    ['a string', 'UNKNOWN_ERROR'],
  ])('maps %s to %s', (error, code) => {
    expect(classifyImportError(error)).toBe(code);
  });
});

describe('resolveAppTemplateOwnerId()', () => {
  beforeEach(() => {
    mocks.ownerRows.length = 0;
  });

  it('returns the first ADMIN user', async () => {
    mocks.ownerRows.push([{ id: 'admin_1' }]);
    await expect(resolveAppTemplateOwnerId()).resolves.toBe('admin_1');
  });

  it('returns null when there is no ADMIN user', async () => {
    mocks.ownerRows.push([]);
    await expect(resolveAppTemplateOwnerId()).resolves.toBeNull();
  });
});

describe('importPackTemplateFromOnlineContent()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.duplicateRows.length = 0;
    mocks.resetInsertCount();
    mocks.generateObject.mockResolvedValue({ object: analysis });
    mocks.batchVectorSearch.mockResolvedValue({ items: [[], []] });
    mocks.templateReturning.mockResolvedValue([created]);
    mocks.itemReturning.mockResolvedValue([{ id: 'pti_1' }, { id: 'pti_2' }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects an invalid URL without fetching', async () => {
    await expect(importPackTemplateFromOnlineContent(args('not a url'))).resolves.toEqual({
      ok: false,
      reason: 'invalid_url',
    });
    expect(mocks.fetchTranscript).toHaveBeenCalledTimes(0);
  });

  it('reports a fetch failure with its message', async () => {
    mocks.fetchTranscript.mockRejectedValue(new Error('Transcript disabled'));
    await expect(importPackTemplateFromOnlineContent(args(youtube))).resolves.toEqual({
      ok: false,
      reason: 'fetch_failed',
      message: 'Transcript disabled',
    });
  });

  it('reports a YouTube URL with no video id as a fetch failure', async () => {
    const result = await importPackTemplateFromOnlineContent(args('https://youtube.com/'));
    expect(result).toEqual({ ok: false, reason: 'fetch_failed', message: 'Invalid YouTube URL' });
  });

  it('refuses a post that was already imported', async () => {
    mocks.fetchTranscript.mockResolvedValue([{ text: 'tent' }]);
    mocks.duplicateRows.push([{ id: 'pt_existing' }]);
    await expect(importPackTemplateFromOnlineContent(args(youtube))).resolves.toEqual({
      ok: false,
      reason: 'duplicate',
      existingTemplateId: 'pt_existing',
    });
    expect(mocks.generateObject).toHaveBeenCalledTimes(0);
  });

  it('imports a YouTube transcript as a template owned by the given user', async () => {
    mocks.fetchTranscript.mockResolvedValue([{ text: 'I pack a tent' }, { text: 'and gels' }]);
    mocks.batchVectorSearch.mockResolvedValue({
      items: [
        [
          {
            id: 9,
            name: 'Catalog Tent',
            description: 'Matched',
            weight: 1100,
            weightUnit: 'g',
            images: ['https://img/tent.jpg'],
          },
        ],
        [],
      ],
    });

    const result = await importPackTemplateFromOnlineContent(args(youtube));

    const [prompt] = mocks.generateObject.mock.calls[0] as [
      { prompt: Array<{ content: Array<{ text?: string }> }> },
    ];
    expect(prompt.prompt[0]?.content[1]?.text).toBe('I pack a tent and gels');
    expect(mocks.templateValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin_1',
        isAppTemplate: false,
        contentSource: 'youtube',
        contentId: 'abc123',
        tags: ['hiking'],
      }),
    );
    const [items] = mocks.itemValues.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(items.map((i) => [i.name, i.weight, i.catalogItemId, i.image])).toEqual([
      ['Catalog Tent', 1100, 9, 'https://img/tent.jpg'],
      ['Gels', 40, null, null],
    ]);
    expect(items[1]?.description).toBeNull();
    expect(result).toEqual({
      ok: true,
      template: { ...created, items: [{ id: 'pti_1' }, { id: 'pti_2' }] },
    });
  });

  it('sends a TikTok video to the model as a file, with its caption', async () => {
    mocks.containerFetch.mockResolvedValue(
      tiktokResponse({ videoUrl: 'https://v/1.mp4', caption: 'my kit', contentId: '42' }),
    );

    await importPackTemplateFromOnlineContent(args(tiktok));

    const [call] = mocks.generateObject.mock.calls[0] as [
      { prompt: Array<{ content: Array<Record<string, string>> }> },
    ];
    const parts = call.prompt[0]?.content ?? [];
    expect(parts[0]?.text).toContain('Retrieved Caption: my kit');
    expect(parts[1]).toEqual({ type: 'file', data: 'https://v/1.mp4', mediaType: 'video/mp4' });
    expect(mocks.templateValues).toHaveBeenCalledWith(
      expect.objectContaining({ contentSource: 'tiktok', contentId: '42' }),
    );
  });

  it('sends a TikTok slideshow as images and falls back to a URL-derived id', async () => {
    mocks.containerFetch.mockResolvedValue(
      tiktokResponse({ imageUrls: ['https://i/1.jpg', 'https://i/2.jpg'] }),
    );

    await importPackTemplateFromOnlineContent(args(tiktok));

    const [call] = mocks.generateObject.mock.calls[0] as [
      { prompt: Array<{ content: Array<Record<string, string>> }> },
    ];
    expect(call.prompt[0]?.content.slice(1)).toEqual([
      { type: 'image', image: 'https://i/1.jpg' },
      { type: 'image', image: 'https://i/2.jpg' },
    ]);
    const [values] = mocks.templateValues.mock.calls[0] as [{ contentId: string }];
    expect(values.contentId).toMatch(/^url_[0-9a-f]+$/);
  });

  it('throws when the TikTok post has neither video nor images', async () => {
    mocks.containerFetch.mockResolvedValue(tiktokResponse({}));
    await expect(importPackTemplateFromOnlineContent(args(tiktok))).rejects.toThrow(
      'No content found in TikTok post',
    );
  });

  it('reports a failing TikTok container as a fetch failure', async () => {
    mocks.containerFetch.mockResolvedValue(tiktokResponse({}, false));
    const result = await importPackTemplateFromOnlineContent(args(tiktok));
    expect(result).toEqual({
      ok: false,
      reason: 'fetch_failed',
      message: 'TikTok container error (502): bad gateway',
    });
  });

  it('reports an unsuccessful TikTok container payload as a fetch failure', async () => {
    mocks.containerFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'Private post' }),
    });
    const result = await importPackTemplateFromOnlineContent(args(tiktok));
    expect(result).toEqual({ ok: false, reason: 'fetch_failed', message: 'Private post' });
  });

  it('skips the catalog search and item insert for an empty gear list', async () => {
    mocks.fetchTranscript.mockResolvedValue([{ text: 'nothing here' }]);
    mocks.generateObject.mockResolvedValue({ object: { ...analysis, items: [] } });

    const result = await importPackTemplateFromOnlineContent(args(youtube));

    expect(mocks.batchVectorSearch).toHaveBeenCalledTimes(0);
    expect(mocks.itemValues).toHaveBeenCalledTimes(0);
    expect(result).toEqual({ ok: true, template: { ...created, items: [] } });
  });

  it('throws when the template insert returns nothing', async () => {
    mocks.fetchTranscript.mockResolvedValue([{ text: 'tent' }]);
    mocks.templateReturning.mockResolvedValue([]);
    await expect(importPackTemplateFromOnlineContent(args(youtube))).rejects.toThrow(
      'Failed to create pack template in database',
    );
  });
});
