alter table public.work_entries
  add column if not exists parts_used jsonb not null default '[]'::jsonb;

comment on column public.work_entries.parts_used is
  'Inventory parts consumed on this work entry: [{partId, partName, unitCost, quantity}]';
