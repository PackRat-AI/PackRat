import { createDb } from '@packrat/api/db';
import { catalogItems, packs } from '@packrat/api/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Context } from 'hono';

// Get pack details from the database
export async function getPackDetails({ packId, c }: { packId: string; c: Context }) {
  const db = createDb(c);

  const packData = await db.query.packs.findFirst({
    where: eq(packs.id, packId),
    with: {
      items: {
        with: {
          catalogItem: true,
        },
      },
      user: true,
    },
  });

  return packData;
}

// Get catalog items from the database
export async function getCatalogItems({
  options,
  c,
}: {
  options?: {
    categories?: string[];
    ids?: number[];
    limit?: number;
  };
  c: Context;
}) {
  const db = createDb(c);
  let query = db.select().from(catalogItems);

  if (options?.categories?.length) {
    query = query.where(inArray(catalogItems.category, options.categories));
  }

  if (options?.ids?.length) {
    query = query.where(inArray(catalogItems.id, options.ids));
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return query;
}

export async function getSchemaInfo(c: Context) {
  const db = createDb(c);

  try {
    // Execute raw SQL queries directly through the sql function
    const schemaQuery = `SELECT 
        t.table_name,
        string_agg(
          c.column_name || ' ' || 
          UPPER(c.data_type) ||
          CASE 
            WHEN c.data_type = 'character varying' THEN '(' || c.character_maximum_length || ')'
            WHEN c.data_type = 'numeric' THEN '(' || c.numeric_precision || ', ' || c.numeric_scale || ')'
            ELSE ''
          END ||
          CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN c.column_default LIKE 'nextval%' THEN ' PRIMARY KEY' ELSE '' END ||
          CASE WHEN tc.constraint_type = 'UNIQUE' THEN ' UNIQUE' ELSE '' END,
          ',\n      '
          ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN information_schema.key_column_usage kcu ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;
    const result = await db.execute(sql.raw(schemaQuery));

    return result.rows
      .map((row) => `${row.table_name} (\n      ${row.columns}\n    );`)
      .join('\n\n');
  } catch (error) {
    console.error('Schema introspection error:', error);
    return {
      success: true,
      data: result.rows
        .map((row) => `${row.table_name} (\n      ${row.columns}\n    );`)
        .join('\n\n'),
    };
  } catch (error) {
    console.error('Schema introspection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
