-- MUV FITNESS - campos extras do catálogo
alter table public.products
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists products_metadata_gin_idx
  on public.products using gin (metadata);
