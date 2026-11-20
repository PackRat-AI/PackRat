-- One-off: collapse catalog_items to one row per product (#2735, #2727).
--
-- Data, not schema: migration 0068 (product_key + catalog_item_offers) must be
-- applied first. Runbook: docs/runbooks/catalog-products-cutover.md.
--
-- Builds catalog_items_new beside the live table, so reads keep working until
-- the short swap transaction at the end. Pause catalog ETL before running.
-- The old table is kept as catalog_items_old; drop it once verified.
--
--   psql "$URL" -X -v ON_ERROR_STOP=1 -f catalog-products-cutover.sql

\timing on
set maintenance_work_mem = '4GB';
set max_parallel_maintenance_workers = 3;
set statement_timeout = 0;

-- Guard: the swap below assumes exactly these inbound foreign keys.
do $$
declare unexpected text;
begin
  select string_agg(conname, ', ') into unexpected
  from pg_constraint
  where confrelid = 'catalog_items'::regclass
    and conname not in (
      'pack_items_catalog_item_id_catalog_items_id_fk',
      'pack_template_items_catalog_item_id_catalog_items_id_fk',
      'catalog_item_etl_jobs_catalog_item_id_catalog_items_id_fk',
      'catalog_item_offers_catalog_item_id_catalog_items_id_fk'
    );
  if unexpected is not null then
    raise exception 'unexpected foreign keys into catalog_items: %', unexpected;
  end if;
end $$;

-- Leftovers from an aborted run; the live table is untouched until step 5.
drop table if exists cutover_keys, cutover_canonical, catalog_items_new, catalog_item_offers_new;

\echo 1/5 product keys
-- Must stay byte-identical to catalogProductKey() in
-- src/services/etl/catalogProduct.ts.
create unlogged table cutover_keys as
select id,
       lower(coalesce(brand, '')) || '|' || regexp_replace(lower(name), '[^a-z0-9]', '', 'g') as product_key,
       embedding is not null as has_embedding,
       weight is not null as has_weight
from catalog_items;

-- Canonical row per product: has an embedding, then a weight, then oldest.
create unlogged table cutover_canonical as
select distinct on (product_key) product_key, id
from cutover_keys
order by product_key, has_embedding desc, has_weight desc, id;
create unique index on cutover_canonical (product_key);

select (select count(*) from cutover_keys) as rows_before,
       (select count(*) from cutover_canonical) as products_after;

\echo 2/5 copy one row per product, fixing weights
create table catalog_items_new (like catalog_items including defaults);

-- oz/lb/kg rows were written by the pre-fix parser, which stored a gram value
-- under the source unit (#2725), so their number is already grams. Weights
-- outside 3 g to 25 kg are dropped, matching normalizeCatalogWeight().
insert into catalog_items_new (
  id, name, product_url, sku, product_key, weight, weight_unit, description, categories,
  images, brand, model, rating_value, color, size, price, availability, seller, product_sku,
  material, currency, condition, review_count, variants, techs, links, reviews, qas, faqs,
  embedding, created_at, updated_at
)
select ci.id, ci.name, ci.product_url, ci.sku, c.product_key,
       case when ci.weight between 3 and 25000 then ci.weight end,
       case when ci.weight between 3 and 25000 and ci.weight_unit is not null then 'g' end,
       ci.description, ci.categories, ci.images, ci.brand, ci.model, ci.rating_value, ci.color,
       ci.size, ci.price, ci.availability, ci.seller, ci.product_sku, ci.material, ci.currency,
       ci.condition, ci.review_count, ci.variants, ci.techs, ci.links, ci.reviews, ci.qas, ci.faqs,
       ci.embedding, ci.created_at, ci.updated_at
from cutover_canonical c
join catalog_items ci using (id);

\echo 3/5 offers
create table catalog_item_offers_new (like catalog_item_offers including defaults);
insert into catalog_item_offers_new (
  catalog_item_id, sku, product_url, price, currency, seller, availability, color, size,
  condition, product_sku, created_at, updated_at
)
select c.id, ci.sku, ci.product_url, ci.price, ci.currency, ci.seller, ci.availability,
       ci.color, ci.size, ci.condition, ci.product_sku, ci.created_at, ci.updated_at
from cutover_keys k
join cutover_canonical c using (product_key)
join catalog_items ci on ci.id = k.id;

\echo 4/5 indexes
alter table catalog_items_new add constraint catalog_items_new_pkey primary key (id);
alter table catalog_items_new add constraint catalog_items_new_sku_unique unique (sku);
alter table catalog_items_new add constraint catalog_items_new_product_key_unique unique (product_key);
create index catalog_items_new_embedding_idx on catalog_items_new using hnsw (embedding vector_cosine_ops);
alter table catalog_item_offers_new add constraint catalog_item_offers_new_pkey primary key (id);
alter table catalog_item_offers_new add constraint catalog_item_offers_new_sku_unique unique (sku);
create index catalog_item_offers_new_catalog_item_id_idx on catalog_item_offers_new (catalog_item_id);
analyze catalog_items_new;
analyze catalog_item_offers_new;

\echo 5/5 swap
begin;
lock table catalog_items, catalog_item_offers, pack_items, pack_template_items, catalog_item_etl_jobs
  in access exclusive mode;

-- Guard: nothing was written to the catalog while the copy ran.
do $$
begin
  if (select max(id) from catalog_items) <> (select max(id) from cutover_keys) then
    raise exception 'catalog_items changed during cutover; is the ETL paused?';
  end if;
end $$;

-- Point pack and template items at the surviving row of their product.
update pack_items p set catalog_item_id = c.id
from cutover_keys k join cutover_canonical c using (product_key)
where p.catalog_item_id = k.id and k.id <> c.id;
update pack_template_items p set catalog_item_id = c.id
from cutover_keys k join cutover_canonical c using (product_key)
where p.catalog_item_id = k.id and k.id <> c.id;

-- Import-history links are retired (approved 2026-11-20).
truncate catalog_item_etl_jobs;

alter table pack_items drop constraint if exists pack_items_catalog_item_id_catalog_items_id_fk;
alter table pack_template_items drop constraint if exists pack_template_items_catalog_item_id_catalog_items_id_fk;
alter table catalog_item_etl_jobs drop constraint if exists catalog_item_etl_jobs_catalog_item_id_catalog_items_id_fk;

alter table catalog_items rename to catalog_items_old;
alter table catalog_items_old rename constraint catalog_items_pkey to catalog_items_old_pkey;
alter table catalog_items_old rename constraint catalog_items_sku_unique to catalog_items_old_sku_unique;
alter table catalog_items_old rename constraint catalog_items_product_key_unique to catalog_items_old_product_key_unique;
alter index embedding_idx rename to catalog_items_old_embedding_idx;

alter table catalog_item_offers rename to catalog_item_offers_old;
alter table catalog_item_offers_old rename constraint catalog_item_offers_pkey to catalog_item_offers_old_pkey;
alter table catalog_item_offers_old rename constraint catalog_item_offers_sku_unique to catalog_item_offers_old_sku_unique;
alter table catalog_item_offers_old drop constraint catalog_item_offers_catalog_item_id_catalog_items_id_fk;
alter index catalog_item_offers_catalog_item_id_idx rename to catalog_item_offers_old_catalog_item_id_idx;

alter table catalog_items_new rename to catalog_items;
alter table catalog_items rename constraint catalog_items_new_pkey to catalog_items_pkey;
alter table catalog_items rename constraint catalog_items_new_sku_unique to catalog_items_sku_unique;
alter table catalog_items rename constraint catalog_items_new_product_key_unique to catalog_items_product_key_unique;
alter index catalog_items_new_embedding_idx rename to embedding_idx;
alter sequence catalog_items_id_seq owned by catalog_items.id;

alter table catalog_item_offers_new rename to catalog_item_offers;
alter table catalog_item_offers rename constraint catalog_item_offers_new_pkey to catalog_item_offers_pkey;
alter table catalog_item_offers rename constraint catalog_item_offers_new_sku_unique to catalog_item_offers_sku_unique;
alter index catalog_item_offers_new_catalog_item_id_idx rename to catalog_item_offers_catalog_item_id_idx;
alter sequence catalog_item_offers_id_seq owned by catalog_item_offers.id;

alter table catalog_item_offers add constraint catalog_item_offers_catalog_item_id_catalog_items_id_fk
  foreign key (catalog_item_id) references catalog_items (id) on delete cascade;
-- not valid: enforced for new writes; older environments carry orphaned
-- references that predate the constraint.
alter table pack_items add constraint pack_items_catalog_item_id_catalog_items_id_fk
  foreign key (catalog_item_id) references catalog_items (id) not valid;
alter table pack_template_items add constraint pack_template_items_catalog_item_id_catalog_items_id_fk
  foreign key (catalog_item_id) references catalog_items (id) not valid;
alter table catalog_item_etl_jobs add constraint catalog_item_etl_jobs_catalog_item_id_catalog_items_id_fk
  foreign key (catalog_item_id) references catalog_items (id) on delete cascade;
commit;

drop table cutover_keys;
drop table cutover_canonical;

select (select count(*) from catalog_items) as products,
       (select count(*) from catalog_item_offers) as offers,
       pg_size_pretty(pg_total_relation_size('catalog_items')) as catalog_size;
