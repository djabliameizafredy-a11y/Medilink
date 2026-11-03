-- Fil d'actualités santé. Lecture publique ; écriture seulement via la clé serveur (service_role), qui contourne RLS.
create table articles (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('medlineplus','europe_pmc','institution')),
  external_id text not null,
  content_type text not null check (content_type in ('advice','news','research')),
  title text not null, summary text, url text not null,
  author text, journal text, doi text, institution text,
  language text not null default 'en', category text, tags text[] default '{}',
  title_fr text, summary_fr text,
  published_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (source, external_id)
);
create index articles_feed on articles (content_type, category, published_at desc nulls last);
alter table articles enable row level security;
create policy "lecture publique des articles" on articles for select using (true);
