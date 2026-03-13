import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { DBConfig } from './constants';
import { env } from './env';
import { QueryBuilder } from './query-builder';

export class PackRatEngine {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;
  readonly bucketPath: string;
  readonly queryBuilder: QueryBuilder;

  constructor() {
    const { R2_BUCKET_NAME } = env();
    this.bucketPath = `s3://${R2_BUCKET_NAME}`;
    this.queryBuilder = new QueryBuilder(this.bucketPath);
  }

  async connect(): Promise<DuckDBConnection> {
    if (this.connection) return this.connection;

    const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL } = env();

    this.instance = await DuckDBInstance.create(':memory:');
    this.connection = await this.instance.connect();

    // Load httpfs extension
    await this.connection.run('INSTALL httpfs; LOAD httpfs;');

    // Configure R2 credentials and DuckDB settings
    const endpoint = R2_ENDPOINT_URL.replace('https://', '');
    await this.connection.run(`
      SET s3_region='auto';
      SET s3_endpoint='${endpoint}';
      SET s3_access_key_id='${R2_ACCESS_KEY_ID}';
      SET s3_secret_access_key='${R2_SECRET_ACCESS_KEY}';
      SET s3_use_ssl=true;
      SET memory_limit='${DBConfig.MEMORY_LIMIT}';
      SET threads=${DBConfig.THREAD_COUNT};
    `);

    return this.connection;
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection = null;
    }
    if (this.instance) {
      this.instance = null;
    }
  }

  getConnection(): DuckDBConnection {
    if (!this.connection) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.connection;
  }
}
