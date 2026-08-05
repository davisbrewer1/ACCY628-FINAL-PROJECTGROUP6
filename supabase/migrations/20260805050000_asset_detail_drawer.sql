-- Full asset detail support for Hardware Assets drawer

alter table public.hardware_assets
  add column if not exists asset_tag text,
  add column if not exists cpu text,
  add column if not exists ram text,
  add column if not exists storage text,
  add column if not exists mac_address text,
  add column if not exists ip_address text,
  add column if not exists battery_health text,
  add column if not exists smart_disk_status text,
  add column if not exists last_check_in timestamptz,
  add column if not exists online_status text default 'Unknown',
  add column if not exists patch_status text,
  add column if not exists antivirus_status text,
  add column if not exists cpu_pct numeric,
  add column if not exists ram_pct numeric,
  add column if not exists disk_pct numeric;

update public.hardware_assets
set asset_tag = asset_number
where asset_tag is null;

create table if not exists public.asset_incidents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hardware_assets (id) on delete cascade,
  title text not null,
  description text,
  severity text default 'Medium',
  status text default 'Open',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_repairs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hardware_assets (id) on delete cascade,
  note text not null,
  repaired_by text,
  status text default 'Logged',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_software (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hardware_assets (id) on delete cascade,
  app_name text not null,
  version text,
  license_status text default 'Unknown',
  update_available boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_monitoring (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hardware_assets (id) on delete cascade,
  checked_at timestamptz not null default now(),
  online_status text,
  patch_status text,
  antivirus_status text,
  cpu_pct numeric,
  ram_pct numeric,
  disk_pct numeric,
  alert_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hardware_assets (id) on delete cascade,
  assigned_user text,
  assigned_location text,
  notes text,
  assigned_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.hardware_assets (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists asset_incidents_asset_id_idx on public.asset_incidents (asset_id, created_at desc);
create index if not exists asset_repairs_asset_id_idx on public.asset_repairs (asset_id, created_at desc);
create index if not exists asset_software_asset_id_idx on public.asset_software (asset_id);
create index if not exists asset_monitoring_asset_id_idx on public.asset_monitoring (asset_id, checked_at desc);
create index if not exists asset_assignments_asset_id_idx on public.asset_assignments (asset_id, assigned_at desc);

alter table public.asset_incidents enable row level security;
alter table public.asset_repairs enable row level security;
alter table public.asset_software enable row level security;
alter table public.asset_monitoring enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_photos enable row level security;

drop policy if exists "Authenticated users can read asset_incidents" on public.asset_incidents;
create policy "Authenticated users can read asset_incidents"
  on public.asset_incidents for select to authenticated using (true);
drop policy if exists "Authenticated users can insert asset_incidents" on public.asset_incidents;
create policy "Authenticated users can insert asset_incidents"
  on public.asset_incidents for insert to authenticated with check (true);

drop policy if exists "Authenticated users can read asset_repairs" on public.asset_repairs;
create policy "Authenticated users can read asset_repairs"
  on public.asset_repairs for select to authenticated using (true);
drop policy if exists "Authenticated users can insert asset_repairs" on public.asset_repairs;
create policy "Authenticated users can insert asset_repairs"
  on public.asset_repairs for insert to authenticated with check (true);

drop policy if exists "Authenticated users can read asset_software" on public.asset_software;
create policy "Authenticated users can read asset_software"
  on public.asset_software for select to authenticated using (true);
drop policy if exists "Authenticated users can insert asset_software" on public.asset_software;
create policy "Authenticated users can insert asset_software"
  on public.asset_software for insert to authenticated with check (true);

drop policy if exists "Authenticated users can read asset_monitoring" on public.asset_monitoring;
create policy "Authenticated users can read asset_monitoring"
  on public.asset_monitoring for select to authenticated using (true);
drop policy if exists "Authenticated users can insert asset_monitoring" on public.asset_monitoring;
create policy "Authenticated users can insert asset_monitoring"
  on public.asset_monitoring for insert to authenticated with check (true);

drop policy if exists "Authenticated users can read asset_assignments" on public.asset_assignments;
create policy "Authenticated users can read asset_assignments"
  on public.asset_assignments for select to authenticated using (true);
drop policy if exists "Authenticated users can insert asset_assignments" on public.asset_assignments;
create policy "Authenticated users can insert asset_assignments"
  on public.asset_assignments for insert to authenticated with check (true);

drop policy if exists "Authenticated users can read asset_photos" on public.asset_photos;
create policy "Authenticated users can read asset_photos"
  on public.asset_photos for select to authenticated using (true);
drop policy if exists "Authenticated users can insert asset_photos" on public.asset_photos;
create policy "Authenticated users can insert asset_photos"
  on public.asset_photos for insert to authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload asset photos" on storage.objects;
create policy "Authenticated users can upload asset photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'asset-photos');

drop policy if exists "Authenticated users can read asset photos" on storage.objects;
create policy "Authenticated users can read asset photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'asset-photos');

-- Seed demo detail rows for existing assets when empty
insert into public.asset_software (asset_id, app_name, version, license_status, update_available)
select a.id, s.app_name, s.version, s.license_status, s.update_available
from public.hardware_assets a
cross join (
  values
    ('Endpoint Protection', '24.1', 'Licensed', false),
    ('Remote Support Agent', '5.2.1', 'Licensed', true),
    ('Office Productivity', '2021', 'Licensed', false)
) as s(app_name, version, license_status, update_available)
where not exists (select 1 from public.asset_software limit 1)
limit 30;

insert into public.asset_monitoring (
  asset_id, online_status, patch_status, antivirus_status, cpu_pct, ram_pct, disk_pct, alert_summary
)
select
  a.id,
  case when a.device_status = 'Offline' then 'Offline' else 'Online' end,
  case when a.missing_security_updates then 'Missing updates' else 'Current' end,
  'Protected',
  22 + (random() * 40)::int,
  35 + (random() * 40)::int,
  40 + (random() * 35)::int,
  case
    when a.needs_replacement then 'Replacement recommended'
    when a.warranty_expiring_soon then 'Warranty expiring soon'
    else null
  end
from public.hardware_assets a
where not exists (select 1 from public.asset_monitoring limit 1);
