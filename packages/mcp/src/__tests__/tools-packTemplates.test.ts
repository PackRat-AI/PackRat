/**
 * Real handler-invocation tests for every tool registered by
 * `registerPackTemplateTools`. Each test drives the registered handler
 * through the shared `_tool-harness` api stub and asserts both the
 * tool's text result and that the expected Treaty endpoint was hit.
 *
 * Two tools (`packrat_create_app_pack_template`,
 * `packrat_generate_pack_template_from_url`) are elicitation-gated; we run
 * their success path by resolving the elicitation with the confirmation
 * text the handler expects (PUBLISH / GENERATE). See tools-admin.test.ts
 * for the same accept pattern.
 */

import { describe, expect, it } from 'vitest';
import { ItemCategory, PackCategory } from '../enums';
import { registerPackTemplateTools } from '../tools/packTemplates';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** Does any recorded call end in `verb` and contain every segment? */
function hasCall(calls: ApiCall[], match: { verb: string; segments: string[] }): boolean {
  return calls.some(
    (c) => c.path.at(-1) === match.verb && match.segments.every((s) => c.path.includes(s)),
  );
}

describe('registerPackTemplateTools — handler invocation', () => {
  it('packrat_list_pack_templates GETs user pack-templates', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_list_pack_templates')({}, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'pack-templates'] })).toBe(true);
  });

  it('packrat_get_pack_template GETs a single template', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_get_pack_template')(
      { template_id: 'tpl-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'pack-templates'] })).toBe(true);
  });

  it('packrat_create_pack_template POSTs a user template', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_pack_template')(
      { name: 'My Pack', category: PackCategory.Hiking },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const post = calls.find((c) => c.path.at(-1) === 'post');
    expect(post?.path.includes('pack-templates')).toBe(true);
    expect((post?.args[0] as { isAppTemplate?: boolean })?.isAppTemplate).toBe(false);
  });

  it('packrat_create_app_pack_template POSTs after PUBLISH confirmation', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'PUBLISH' } },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated Pack', category: PackCategory.Camping },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const post = calls.find((c) => c.path.at(-1) === 'post');
    expect(post?.path.includes('pack-templates')).toBe(true);
    expect((post?.args[0] as { isAppTemplate?: boolean })?.isAppTemplate).toBe(true);
  });

  it('packrat_update_pack_template PUTs a template', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template')(
      { template_id: 'tpl-1', name: 'Renamed', category: PackCategory.Custom },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'put', segments: ['user', 'pack-templates'] })).toBe(true);
  });

  it('packrat_delete_pack_template DELETEs a template', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_pack_template')(
      { template_id: 'tpl-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'delete', segments: ['user', 'pack-templates'] })).toBe(true);
  });

  it('packrat_list_pack_template_items GETs template items', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_list_pack_template_items')(
      { template_id: 'tpl-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'get', segments: ['user', 'pack-templates', 'items'] })).toBe(
      true,
    );
  });

  it('packrat_add_pack_template_item POSTs an item', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_add_pack_template_item')(
      {
        template_id: 'tpl-1',
        name: 'Tent',
        weight: 1200,
        weight_unit: 'g',
        quantity: 1,
        category: ItemCategory.Shelter,
        consumable: false,
        worn: false,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'post', segments: ['user', 'pack-templates', 'items'] })).toBe(
      true,
    );
  });

  it('packrat_update_pack_template_item PATCHes an item with snake→camel rename', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template_item')(
      { item_id: 'item-1', name: 'New Name', weight_unit: 'oz' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    const patch = calls.find((c) => c.path.at(-1) === 'patch');
    expect(patch?.path.includes('items')).toBe(true);
    expect((patch?.args[0] as { weightUnit?: string })?.weightUnit).toBe('oz');
  });

  it('packrat_delete_pack_template_item DELETEs an item', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_pack_template_item')(
      { item_id: 'item-1' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCall(calls, { verb: 'delete', segments: ['user', 'pack-templates', 'items'] })).toBe(
      true,
    );
  });

  it('packrat_generate_pack_template_from_url POSTs after GENERATE confirmation', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'GENERATE' } },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_generate_pack_template_from_url')(
      { content_url: 'https://youtube.com/watch?v=abc', is_app_template: false },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(
      hasCall(calls, {
        verb: 'post',
        segments: ['user', 'pack-templates', 'generate-from-online-content'],
      }),
    ).toBe(true);
  });
});

// ── Optional-omitted body-building ──────────────────────────────────────────

/** Body object passed to the terminal verb call. */
function bodyOf(calls: ApiCall[], verb: string): Record<string, unknown> {
  const call = calls.find((c) => c.path.at(-1) === verb);
  return (call?.args[0] ?? {}) as Record<string, unknown>;
}

/** Structured error code from an isError envelope. */
function errorCodeOf(structured: Record<string, unknown> | undefined): unknown {
  return (structured?.error as { code?: unknown } | undefined)?.code;
}

describe('packTemplates — optional fields omitted', () => {
  it('create_pack_template omits description/image/tags when not supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_pack_template')(
      { name: 'Bare', category: PackCategory.Hiking },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'post');
    expect(body.description).toBeUndefined();
    expect(body.image).toBeUndefined();
    expect(body.tags).toBeUndefined();
    expect(body.isAppTemplate).toBe(false);
  });

  it('update_pack_template maps unset optionals to null and omits name/category', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template')(
      { template_id: 'tpl-1' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'put');
    expect(Object.keys(body)).not.toContain('name');
    expect(Object.keys(body)).not.toContain('category');
    expect(body.description).toBeNull();
    expect(body.image).toBeNull();
    expect(body.tags).toBeNull();
    expect(Object.keys(body)).toContain('localUpdatedAt');
  });

  it('add_pack_template_item omits description/image/notes when not supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_add_pack_template_item')(
      {
        template_id: 'tpl-1',
        name: 'Stove',
        weight: 90,
        weight_unit: 'g',
        quantity: 1,
        category: ItemCategory.Tools,
        consumable: false,
        worn: false,
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'post');
    expect(body.description).toBeUndefined();
    expect(body.image).toBeUndefined();
    expect(body.notes).toBeUndefined();
  });

  it('update_pack_template_item builds a body with only supplied fields', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template_item')(
      { item_id: 'item-1', name: 'Only Name' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'patch');
    expect(body.name).toBe('Only Name');
    for (const k of [
      'description',
      'weight',
      'weightUnit',
      'quantity',
      'category',
      'consumable',
      'worn',
      'image',
      'notes',
    ]) {
      expect(Object.keys(body)).not.toContain(k);
    }
  });
});

// ── Elicitation-declined paths (default cancel agent) ───────────────────────

describe('packTemplates — elicitation declined', () => {
  it('create_app_pack_template returns a structured error when cancelled', async () => {
    const { agent, server, calls } = makeAgent(); // default elicit → { action: 'cancel' }
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
    // Declined before any API write.
    expect(hasCall(calls, { verb: 'post', segments: ['pack-templates'] })).toBe(false);
  });

  it('generate_pack_template_from_url returns a structured error when cancelled', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_generate_pack_template_from_url')(
      { content_url: 'https://youtube.com/watch?v=abc', is_app_template: true },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
    expect(
      hasCall(calls, {
        verb: 'post',
        segments: ['generate-from-online-content'],
      }),
    ).toBe(false);
  });
});

// ── Error-path cases (one per distinct verb) ────────────────────────────────

describe('packTemplates error paths — apiFail returns structured error', () => {
  it('list_pack_templates (GET) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_list_pack_templates')({}, makeExtra());
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });

  it('create_pack_template (POST) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_pack_template')(
      { name: 'X', category: PackCategory.Hiking },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });

  it('update_pack_template (PUT) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template')(
      { template_id: 'tpl-1', name: 'Y' },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });

  it('update_pack_template_item (PATCH) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template_item')(
      { item_id: 'item-1', name: 'Z' },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });

  it('delete_pack_template (DELETE) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_pack_template')(
      { template_id: 'tpl-1' },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });

  it('create_app_pack_template (POST) surfaces an error envelope on accept+apiFail', async () => {
    const { agent, server } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'PUBLISH' } },
      apiFail: true,
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });

  it('generate_pack_template_from_url (POST) surfaces an error envelope on accept+apiFail', async () => {
    const { agent, server } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'GENERATE' } },
      apiFail: true,
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_generate_pack_template_from_url')(
      { content_url: 'https://youtube.com/watch?v=abc', is_app_template: false },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(typeof errorCodeOf(result.structuredContent)).toBe('string');
    expect((errorCodeOf(result.structuredContent) as string).length).toBeGreaterThan(0);
  });
});

// ── Distinct ConfirmReason branches in the elicit-failure switches ──────────
// elicitFailureResponse + auditElicitDeclined each switch on the four
// ConfirmReason arms. The cancelled arm is covered above; here we drive the
// remaining three (mismatch / timeout / unsupported) through
// create_app_pack_template, which routes every reason through both switches.

describe('packTemplates — elicit-failure reason mapping', () => {
  it("maps 'accept' with a wrong confirmation to confirmation_mismatch", async () => {
    const { agent, server } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'NOPE' } },
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(errorCodeOf(result.structuredContent)).toBe('confirmation_mismatch');
  });

  it('maps an SDK timeout rejection to confirmation_timeout', async () => {
    const { agent, server } = makeAgent({
      reject: new Error('Elicitation request timed out'),
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(errorCodeOf(result.structuredContent)).toBe('confirmation_timeout');
  });

  it('maps a missing-capability rejection to elicitation_unsupported', async () => {
    const { agent, server } = makeAgent({
      reject: new Error('Client does not support elicitation (required for elicitation/create)'),
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(errorCodeOf(result.structuredContent)).toBe('elicitation_unsupported');
  });
});

// ── getAuditContext present branch (auditCtxFor) ────────────────────────────
// The shared harness agent omits getAuditContext, so the `?? {…}` fallback is
// always taken. Provide one here to cover the present branch on both gated
// tools' audit paths.

describe('packTemplates — getAuditContext provided', () => {
  it('create_app_pack_template reads the supplied audit context (accept path)', async () => {
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'PUBLISH' } },
    });
    agent.getAuditContext = () => ({
      userId: 'u_admin',
      scopes: ['mcp:admin'],
      correlationId: 'session:test',
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const post = calls.find((c) => c.path.at(-1) === 'post');
    expect((post?.args[0] as { isAppTemplate?: boolean })?.isAppTemplate).toBe(true);
  });

  it('create_app_pack_template reads the supplied audit context (declined path)', async () => {
    const { agent, server } = makeAgent(); // default cancel
    agent.getAuditContext = () => ({
      userId: 'u_admin',
      scopes: ['mcp:admin'],
      correlationId: 'session:test',
    });
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_create_app_pack_template')(
      { name: 'Curated', category: PackCategory.Camping },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    expect(errorCodeOf(result.structuredContent)).toBe('user_cancelled');
  });
});

// ── update_pack_template_item: undefined-field skip branch ──────────────────
// The PATCH body loop has `if (v === undefined) continue`. Passing an explicit
// `undefined` for an optional field exercises the skip arm.

describe('packTemplates — update_pack_template_item undefined skip', () => {
  it('skips fields whose value is explicitly undefined', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTemplateTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_template_item')(
      { item_id: 'item-1', name: 'Kept', description: undefined, weight_unit: undefined },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'patch');
    expect(body.name).toBe('Kept');
    expect(Object.keys(body)).not.toContain('description');
    expect(Object.keys(body)).not.toContain('weightUnit');
  });
});
