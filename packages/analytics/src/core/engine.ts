import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_ENDPOINT_URL, R2_SECRET_ACCESS_KEY } from './env.js';

export class PackRatEngine {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;
  readonly bucketPath: string;

  constructor() {
    this.bucketPath = `s3://${R2_BUCKET_NAME}`;
  }

  async connect(): Promise<DuckDBConnection> {
    if (this.connection) return this.connection;

    this.instance = await DuckDBInstance.create(':memory:');
    this.connection = await this.instance.connect();

    // Load httpfs extension
    await this.connection.run('INSTALL httpfs; LOAD httpfs;');

    // Configure R2 credentials
    const endpoint = R2_ENDPOINT_URL.replace('https://', '');
    await this.connection.run(`
      SET s3_region='auto';
      SET s3_endpoint='${endpoint}';
      SET s3_access_key_id='${R2_ACCESS_KEY_ID}';
      SET s3_secret_access_key='${R2_SECRET_ACCESS_KEY}';
      SET s3_use_ssl=true;
      SET memory_limit='8GB';
      SET threads=4;
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
