import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';

// Create a PostgreSQL client for testing
export const createTestDbConnection = () => {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'packrat_test',
    user: 'test_user',
    password: 'test_password',
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
};