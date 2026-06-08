> This page location: Neon platform > Monitoring & observability > Query performance
> Full Neon documentation index: https://neon.com/docs/llms.txt

> Summary: The Query performance tab in the Neon Console Monitoring page displays the top previously run queries for a branch, compute, and database, grouped by normalized form and sortable by frequency or average execution time. Use it to identify slow or high-frequency queries without installing any extensions, since the view is built on the `pg_stat_statements` extension installed on a system-managed database. Query history resets whenever the Neon compute suspends or restarts, including after scaling to zero due to inactivity.

# Monitor query performance

View and analyze query performance for your Neon database

You can monitor query history for your Neon project from the **Monitoring** page in the Neon Console.

1. In the Neon Console, select a project.
2. Go to **Monitoring**.
3. Select the **Query performance** tab.

The **Query performance** view shows the top 100 previously run queries for the selected **Branch**, **Compute**, and **Database**. Queries are grouped by their normalized form, with identical queries shown as a single row with a **Frequency** column indicating the number of times that query has been executed. Queries can be sorted by **Frequency** or **Average time**. Use the **Refresh** button to load the latest queries.

![Neon query performance tab](https://neon.com/docs/introduction/query_performance.png)

The **Query performance** view is powered by the `pg_stat_statements` Postgres extension, installed on a system managed database in your Postgres instance. Query history includes all queries run against your database, regardless of where they were issued from (Neon SQL Editor, external clients, or applications).

**Note: Query history when compute restarts**

In Neon, data collected by the `pg_stat_statements` extension is not retained when your Neon compute (where Postgres runs) is suspended or restarted. For example, if your compute scales down to zero due to inactivity, your query history is lost. New data will be gathered once your compute restarts.

## Running your own queries

To run your own queries on `pg_stat_statements` data, you can install the `pg_stat_statements` extension to your database and run your queries from the [Neon SQL Editor](https://neon.com/docs/get-started/query-with-neon-sql-editor) or any SQL client, such as [psql](https://neon.com/docs/connect/query-with-psql-editor). For details on `pg_stat_statements`, including how to install it, what data it collects, and queries you can run, refer to our [pg_stat_statements](https://neon.com/docs/extensions/pg_stat_statements) extension guide.

---

## Related docs (Monitoring & observability)

- [Overview](https://neon.com/docs/introduction/monitoring)
- [Monitoring dashboard](https://neon.com/docs/introduction/monitoring-page)
- [System operations](https://neon.com/docs/manage/operations)
- [Active queries](https://neon.com/docs/introduction/monitor-active-queries)
