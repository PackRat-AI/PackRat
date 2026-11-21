# Catalog products cutover (#2735, #2727)

One-off rebuild of `catalog_items` to one row per product, with every retailer listing kept in `catalog_item_offers`. Script: `packages/api/scripts/catalog-products-cutover.sql`.

## What it does

- Keys every row by brand + name, each stripped to ASCII letters and digits and lower-cased (same rule as `catalogProductKey()` in the ETL).
- Keeps one row per product (has an embedding, then a weight, then the oldest id) and copies it into a new table beside the live one, so reads keep working.
- Fixes weights on the way: oz/lb/kg values are relabelled as grams (the pre-fix parser stored grams under the source unit), and anything with no unit or outside 3 g to 25 kg is cleared.
- Copies every listing into `catalog_item_offers`.
- In one short transaction: re-points `pack_items` and `pack_template_items` at the surviving row, empties `catalog_item_etl_jobs` (import-history links, retired with approval on 2026-11-20), and swaps the tables. The old table stays as `catalog_items_old`.

## Measured cost

Rehearsed on a 10% sample of production on 2026-11-20: under 3 minutes and at most $0.02. Full run extrapolates to about 25 minutes and about $0.20 at 4 CU, $0.50 at worst. The catalog drops from 33 GB to about 6.5 GB once `catalog_items_old` is dropped, about $9 a month less in storage.

## Order of operations

1. Merge and release the PR, so migration 0068 (`product_key`, `catalog_item_offers`) is applied on production and the ETL that writes one row per product is deployed.
2. Pause catalog ETL. The script aborts if `catalog_items` gains a row while it runs.
3. Take a Neon snapshot of `main` (about $0.70 for a week). This is the rollback.
4. Run against the direct (non-pooler) `main` endpoint: `psql "$URL" -X -v ON_ERROR_STOP=1 -f packages/api/scripts/catalog-products-cutover.sql`. It is safe to re-run if it fails before step 5.
5. Check the catalog in the apps, then `drop table catalog_items_old, catalog_item_offers_old;` to release the storage.
6. Resume ETL.

## Rollback

Before step 5 of the script nothing live has changed: drop `catalog_items_new`, `catalog_item_offers_new`, `cutover_keys` and `cutover_canonical`. After the swap, restore from the snapshot taken in step 3, or swap `catalog_items_old` back by reversing the renames.
