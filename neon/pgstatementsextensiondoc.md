> This page location: Extensions > pg_stat_statements
> Full Neon documentation index: https://neon.com/docs/llms.txt

> Summary: The `pg_stat_statements` extension records per-query execution counts, total and mean execution times, and row counts in a queryable view. Use it to identify slow queries, high-frequency queries, and cache inefficiency without external tooling. On Neon, statistics reset whenever the compute suspends or scales to zero. Only `neon_superuser` roles can call `pg_stat_statements_reset()` to clear accumulated stats manually.

# The pg_stat_statements extension

Track planning and execution statistics for all SQL statements

The `pg_stat_statements` extension provides a detailed statistical view of SQL statement execution within a Postgres database. It tracks information such as execution counts, total and average execution times, and more, helping database administrators and developers analyze and optimize SQL query performance.

> **Try it on Neon!**
>
> Neon is Serverless Postgres built for the cloud. Explore Postgres features and functions in our user-friendly SQL editor. Sign up for a free account to get started.
>
> [Sign Up](https://console.neon.tech/signup)

This guide covers:

- [Enabling pg_stat_statements](https://neon.com/docs/extensions/pg_stat_statements#enable-the-pgstatstatements-extension)
- [Usage examples](https://neon.com/docs/extensions/pg_stat_statements#usage-examples)
- [Resetting statistics](https://neon.com/docs/extensions/pg_stat_statements#reset-statistics)

**Note:** `pg_stat_statements` is an open-source extension for Postgres that can be installed on any Neon project using the instructions below.

### Version availability

The version of `pg_stat_statements` available on Neon depends on the version of Postgres you select for your Neon project. For supported extension versions, see [Supported Postgres extensions](https://neon.com/docs/extensions/pg-extensions).

### Data persistence

In Neon, statistics collected by the `pg_stat_statements` extension are not retained when your Neon compute (where Postgres runs) is suspended or restarted. For example, if your compute scales down to zero due to inactivity, any existing statistics are lost. New statistics will be gathered once your compute restarts. For more details about the lifecycle of a Neon compute, see [Compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle). For information about configuring Neon's scale to zero behavior, see [Scale to Zero](https://neon.com/docs/introduction/scale-to-zero).

## Enable the `pg_stat_statements` extension

The extension is installed by running the following `CREATE EXTENSION` statement in the Neon **SQL Editor** or from a client such as `psql` that is connected to Neon.

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

For information about using the Neon SQL Editor, see [Query with Neon's SQL Editor](https://neon.com/docs/get-started/query-with-neon-sql-editor). For information about using the `psql` client with Neon, see [Connect with psql](https://neon.com/docs/connect/query-with-psql-editor).

## Usage examples

This section provides `pg_stat_statements` usage examples.

### Query the pg_stat_statements view

The main interface is the `pg_stat_statements` view, which contains one row per distinct database query, showing various statistics.

```sql
SELECT * FROM pg_stat_statements LIMIT 10;
```

The view contains details like those shown below:

```
| userid | dbid  | queryid               | query                 | calls |
|--------|-------|-----------------------|-----------------------|-------|
| 16391  | 16384 | -9047282044438606287  | SELECT * FROM users;  | 10    |
```

For a complete list of `pg_stat_statements` columns and descriptions, see [The pg_stat_statements View](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-PG-STAT-STATEMENTS).

Let's explore some example usage patterns.

### Find the most frequently executed queries

The most frequently run queries are often critical paths and optimization candidates.

This query retrieves details about the most frequently executed queries, ordered by the number of calls. Only the top 10 rows are returned (`LIMIT 10`):

```sql
SELECT
  userid,
  query,
  calls,
  (total_exec_time / 1000 / 60) as total_min,
  mean_exec_time as avg_ms
FROM pg_stat_statements
ORDER BY 3 DESC
LIMIT 10;
```

### Monitor slow queries

A high average runtime can indicate an inefficient query.

The query below uses the `query`, `mean_exec_time` (average execution time per call), and `calls` columns. The condition `WHERE mean_exec_time > 1` filters out queries with an average execution time greater than 1 unit (you may adjust this threshold as needed).

```sql
SELECT
    query,
    mean_exec_time,
    calls
FROM
    pg_stat_statements
WHERE
    mean_exec_time > 1
ORDER BY
    mean_exec_time DESC;
```

This query returns the following results:

```
| Query                                         | Mean Time | Calls |
|-----------------------------------------------|-----------|-------|
| SELECT p.*, c.name AS category FROM products  | 250.60ms  |  723  |
```

This query retrieves the top 10 queries with the highest average execution time, focusing on queries run more than 500 times, for the current user.

```sql
WITH statements AS (
    SELECT *
    FROM pg_stat_statements pss
    JOIN pg_roles pr ON (pss.userid = pr.oid)
    WHERE pr.rolname = current_user
)
SELECT
    calls,
    mean_exec_time,
    query
FROM statements
WHERE
    calls > 500
    AND shared_blks_hit > 0
ORDER BY
    mean_exec_time DESC
LIMIT 10;
```

This query returns the 10 longest-running queries for the current user, focusing on those executed over 500 times and with some cache usage. It orders queries by frequency and cache efficiency to highlight potential areas for optimization.

```sql
WITH statements AS (
    SELECT *
    FROM pg_stat_statements pss
    JOIN pg_roles pr ON (pss.userid = pr.oid)
    WHERE pr.rolname = current_user
)
SELECT
    calls,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_hit / (shared_blks_hit + shared_blks_read)::NUMERIC * 100 AS hit_cache_ratio,
    query
FROM statements
WHERE
    calls > 500
    AND shared_blks_hit > 0
ORDER BY
    calls DESC,
    hit_cache_ratio ASC
LIMIT 10;
```

This query retrieves the top 10 longest-running queries (in terms of mean execution time), focusing on queries executed more than 500 times, for the current user.

```sql
WITH statements AS (
    SELECT *
    FROM pg_stat_statements pss
    JOIN pg_roles pr ON (userid = oid)
    WHERE rolname = current_user
)
SELECT
    calls,
    min_exec_time,
    max_exec_time,
    mean_exec_time,
    stddev_exec_time,
    (stddev_exec_time / mean_exec_time) AS coeff_of_variance,
    query
FROM statements
WHERE calls > 500
AND shared_blks_hit > 0
ORDER BY mean_exec_time DESC
```

### Find queries that return many rows

To identify queries that return a lot of rows, you can select the `query` and `rows` columns, representing the SQL statement and the number of rows returned by each statement, respectively.

```sql
SELECT
    query,
    rows
FROM
    pg_stat_statements
ORDER BY
    rows DESC
LIMIT
    10;
```

This query returns results similar to the following:

```
| Query                                             | Rows    |
|---------------------------------------------------|---------|
| SELECT * FROM products;                           | 112,394 |
| SELECT * FROM users;                              | 98,723  |
| SELECT p.*, c.name AS category FROM products      | 23,984  |
```

### Find the most time-consuming queries

The following query returns details about the most time-consuming queries, ordered by execution time.

```sql
SELECT
  userid,
  query,
  calls,
  total_exec_time,
  rows
FROM
  pg_stat_statements
ORDER BY
  total_exec_time DESC
LIMIT 10;
```

## Reset statistics

When executed, the `pg_stat_statements_reset()` function resets the accumulated statistical data, such as execution times and counts for SQL statements, to zero. Use it when you want to start fresh with performance statistics collection.

**Note:** In Neon, only [neon_superuser](https://neon.com/docs/manage/roles#the-neonsuperuser-role) roles have the privilege required to execute this function. The default role created with a Neon project and roles created in the Neon Console, CLI, and API are granted membership in the `neon_superuser` role.

```sql
SELECT pg_stat_statements_reset();
```

## Resources

- [PostgreSQL documentation for pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

---

## Related docs (Extensions)

- [Extension explorer](https://neon.com/docs/extensions/extension-explorer)
- [anon](https://neon.com/docs/extensions/postgresql-anonymizer)
- [btree_gin](https://neon.com/docs/extensions/btree_gin)
- [btree_gist](https://neon.com/docs/extensions/btree_gist)
- [citext](https://neon.com/docs/extensions/citext)
- [cube](https://neon.com/docs/extensions/cube)
- [dblink](https://neon.com/docs/extensions/dblink)
- [dict_int](https://neon.com/docs/extensions/dict_int)
- [earthdistance](https://neon.com/docs/extensions/earthdistance)
- [fuzzystrmatch](https://neon.com/docs/extensions/fuzzystrmatch)
- [hstore](https://neon.com/docs/extensions/hstore)
- [intarray](https://neon.com/docs/extensions/intarray)
- [ltree](https://neon.com/docs/extensions/ltree)
- [neon](https://neon.com/docs/extensions/neon)
- [neon_utils](https://neon.com/docs/extensions/neon-utils)
- [online_advisor](https://neon.com/docs/extensions/online_advisor)
- [pgcrypto](https://neon.com/docs/extensions/pgcrypto)
- [pgvector](https://neon.com/docs/extensions/pgvector)
- [pgrag](https://neon.com/docs/extensions/pgrag)
- [pg_cron](https://neon.com/docs/extensions/pg_cron)
- [pg_graphql](https://neon.com/docs/extensions/pg_graphql)
- [pg_mooncake](https://neon.com/docs/extensions/pg_mooncake)
- [pg_partman](https://neon.com/docs/extensions/pg_partman)
- [pg_prewarm](https://neon.com/docs/extensions/pg_prewarm)
- [pg_session_jwt](https://neon.com/docs/extensions/pg_session_jwt)
- [pg_repack](https://neon.com/docs/extensions/pg_repack)
- [pg_search](https://neon.com/docs/extensions/pg_search)
- [pg_tiktoken](https://neon.com/docs/extensions/pg_tiktoken)
- [pg_trgm](https://neon.com/docs/extensions/pg_trgm)
- [pg_uuidv7](https://neon.com/docs/extensions/pg_uuidv7)
- [pgrowlocks](https://neon.com/docs/extensions/pgrowlocks)
- [pgstattuple](https://neon.com/docs/extensions/pgstattuple)
- [plv8](https://neon.com/docs/extensions/plv8)
- [postgis](https://neon.com/docs/extensions/postgis)
- [postgis-related](https://neon.com/docs/extensions/postgis-related-extensions)
- [postgres_fdw](https://neon.com/docs/extensions/postgres_fdw)
- [tablefunc](https://neon.com/docs/extensions/tablefunc)
- [timescaledb](https://neon.com/docs/extensions/timescaledb)
- [unaccent](https://neon.com/docs/extensions/unaccent)
- [uuid-ossp](https://neon.com/docs/extensions/uuid-ossp)
- [wal2json](https://neon.com/docs/extensions/wal2json)
- [xml2](https://neon.com/docs/extensions/xml2)
