import { createDb } from '@packrat/api/db';
import {
  type PackTemplateWithItems,
  packTemplateItems,
  packTemplates,
} from '@packrat/api/db/schema';
import { and, eq, or } from 'drizzle-orm';
import type { Context } from 'hono';

export class PackTemplateService {
  private db;
  private userId: number;
  private readonly c: Context;

  constructor(c: Context, userId: number) {
    this.db = createDb(c);
    this.userId = userId;
    this.c = c;
  }

  async getPackTemplateDetails(templateId: string): Promise<PackTemplateWithItems | null> {
    const template = await this.db.query.packTemplates.findFirst({
      where: and(
        eq(packTemplates.id, templateId),
        or(
          eq(packTemplates.userId, this.userId), // user can access their own templates
          eq(packTemplates.isAppTemplate, true), // or app templates
        ),
        eq(packTemplates.deleted, false),
      ),
      with: {
        items: {
          where: eq(packTemplateItems.deleted, false),
        },
      },
    });

    return template || null;
  }
}
