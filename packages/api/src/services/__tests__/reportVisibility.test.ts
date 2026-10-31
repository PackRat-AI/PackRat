import { drizzle } from 'drizzle-orm/neon-http';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { visibleToViewer } from '../reportVisibility';

// Builds queries without a connection; visibleToViewer only composes SQL.
const db = drizzle.mock();

describe('visibleToViewer', () => {
  it('hides reports the viewer flagged and authors on either side of a block', () => {
    const q = new PgDialect().sqlToQuery(visibleToViewer({ db, viewerId: 'me' }));

    expect(q.sql).toBe(
      '("trail_condition_reports"."id" not in (select "report_id" from "trail_condition_report_flags" where "trail_condition_report_flags"."reporter_id" = $1)' +
        ' and "trail_condition_reports"."user_id" not in (select "blocked_id" from "user_blocks" where "user_blocks"."blocker_id" = $2)' +
        ' and "trail_condition_reports"."user_id" not in (select "blocker_id" from "user_blocks" where "user_blocks"."blocked_id" = $3))',
    );
    expect(q.params).toEqual(['me', 'me', 'me']);
  });
});
