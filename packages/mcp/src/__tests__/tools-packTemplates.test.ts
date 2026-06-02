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
      { template_id: 'tpl-1', name: 'Renamed', category: PackCategory.Travel },
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
