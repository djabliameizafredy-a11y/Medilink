-- Medilink : schéma Supabase (à exécuter dans SQL Editor). Phase 2 branchera le site dessus.
create table facilities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hospital','clinic','pharmacy')),
  name text not null, city text, country text,
  lat double precision, lng double precision, phone text, address text,
  osm_id text unique, is_verified boolean default false,
  on_duty boolean default false, availability text, beds int, ambulances int,
  verified_at timestamptz, verified_by text  -- 'staff' | 'ordre' | 'appel-ia'
);
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('staff','admin')),
  facility_id uuid references facilities(id)
);
create table requests (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default substr(md5(random()::text), 1, 8),
  kind text check (kind in ('hospital','pharmacy')),
  facility_id uuid references facilities(id),
  osm_id text, facility_name text,
  patient_name text, patient_phone text, patient_coords text,
  condition text, urgency text,
  status text not null default 'Envoyée' check (status in ('Envoyée','Reçue','En cours de coordination','Clôturée')),
  created_at timestamptz default now()
);
create table messages (
  id bigint generated always as identity primary key,
  request_id uuid references requests(id) on delete cascade,
  sender text, body text, created_at timestamptz default now()
);
alter table facilities enable row level security;
alter table profiles enable row level security;
alter table requests enable row level security;
alter table messages enable row level security;
create policy "annuaire public" on facilities for select using (true);
create policy "staff gère son établissement" on facilities for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'admin' or p.facility_id = facilities.id)));
create policy "créer une demande" on requests for insert with check (true);
create policy "historique de son établissement" on requests for select using (
  exists (select 1 from profiles p left join facilities f on f.id = p.facility_id
    where p.id = auth.uid() and (p.role = 'admin' or p.facility_id = requests.facility_id
      or (f.osm_id is not null and f.osm_id = requests.osm_id))));
create policy "admin met à jour" on requests for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "profil personnel" on profiles for select using (id = auth.uid());
-- Le demandeur suit sa demande avec son code, via cette fonction (pas de lecture publique de la table).
create function suivre_demande(c text) returns table(status text, facility text, created_at timestamptz)
language sql security definer as $$
  select r.status, f.name, r.created_at from requests r left join facilities f on f.id = r.facility_id where r.code = c $$;
