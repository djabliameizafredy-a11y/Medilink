-- Medilink : schéma Supabase, tel qu'appliqué sur le projet « medilink » (migrations medilink_schema et medilink_policies_sans_chevauchement).
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hospital','clinic','pharmacy')),
  name text not null, city text, country text,
  lat double precision, lng double precision, phone text, address text,
  osm_id text unique, is_verified boolean not null default false,
  on_duty boolean not null default false, availability text, beds int, ambulances int,
  verified_at timestamptz, verified_by text
);
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('staff','admin')),
  facility_id uuid references public.facilities(id)
);
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default substr(md5(random()::text), 1, 8),
  kind text check (kind in ('hospital','pharmacy')),
  facility_id uuid references public.facilities(id),
  osm_id text, facility_name text,
  patient_name text, patient_phone text, patient_coords text,
  condition text, urgency text,
  status text not null default 'Envoyée' check (status in ('Envoyée','Reçue','En cours de coordination','Clôturée')),
  created_at timestamptz not null default now(),
  constraint requests_taille check (
    char_length(coalesce(patient_name, '')) <= 80 and char_length(coalesce(patient_phone, '')) <= 30
    and char_length(coalesce(condition, '')) <= 300 and char_length(coalesce(urgency, '')) <= 30
    and char_length(coalesce(facility_name, '')) <= 200 and char_length(coalesce(osm_id, '')) <= 60)
);
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  full_name text not null check (char_length(full_name) <= 80),
  domain text check (char_length(domain) <= 60), specialty text check (char_length(specialty) <= 60),
  experience_years int check (experience_years between 0 and 70),
  bio text check (char_length(bio) <= 400), photo_path text,
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at timestamptz not null default now()
);
create index on public.profiles (facility_id);
create index on public.requests (facility_id);
create index on public.requests (osm_id);
create index on public.requests (created_at desc);
create index on public.professionals (facility_id);

alter table public.facilities enable row level security;
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.professionals enable row level security;

-- Établissements : lecture publique ; seul un admin écrit (le personnel ne peut pas se déclarer « vérifié »).
create policy facilities_lecture_publique on public.facilities for select using (true);
create policy facilities_admin_insert on public.facilities for insert
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy facilities_admin_update on public.facilities for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy facilities_admin_delete on public.facilities for delete
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy profiles_personnel on public.profiles for select using (id = (select auth.uid()));

-- Demandes : un visiteur peut en créer (statut « Envoyée » seulement) mais jamais les lire ; l'établissement lit les siennes.
create policy requests_creation_publique on public.requests for insert
  with check (status = 'Envoyée' and char_length(code) between 6 and 20);
create policy requests_historique on public.requests for select using (
  exists (select 1 from public.profiles p left join public.facilities f on f.id = p.facility_id
    where p.id = (select auth.uid()) and (p.role = 'admin' or p.facility_id = requests.facility_id
      or (f.osm_id is not null and f.osm_id = requests.osm_id))));
create policy requests_admin_maj on public.requests for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Professionnels : visibles du public seulement une fois « approved » (par un admin).
create policy professionals_select on public.professionals for select using (
  status = 'approved'
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.role = 'admin' or p.facility_id = professionals.facility_id)));
create policy professionals_insert on public.professionals for insert
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and (p.role = 'admin' or (p.facility_id = professionals.facility_id and professionals.status in ('pending','hidden')))));
create policy professionals_update on public.professionals for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.role = 'admin' or p.facility_id = professionals.facility_id)))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and (p.role = 'admin' or (p.facility_id = professionals.facility_id and professionals.status in ('pending','hidden')))));
create policy professionals_delete on public.professionals for delete
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.role = 'admin' or p.facility_id = professionals.facility_id)));

-- Photos : adresse publique, mais pas de liste ; 2 Mo, JPEG/PNG ; dépôt dans le dossier de son établissement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('professionals', 'professionals', true, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png'];
create policy photos_depot_etablissement on storage.objects for insert to authenticated
  with check (bucket_id = 'professionals' and exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and (p.role = 'admin' or p.facility_id::text = (storage.foldername(name))[1])));
