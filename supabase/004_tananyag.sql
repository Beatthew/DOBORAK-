-- BEATHUB, 4. lépés: a tananyag. A beépített kategóriák és az eddig tanított anyag a kódban él;
-- ide az kerül, amit a tanár az appban hozzáad (új kategória, új tétel).
-- SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.

create table if not exists public.library_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- category: a beépített kategória azonosítója (pl. 'grooveok') vagy egy library_categories.id
-- bars: a kotta ütemei, [{ "beats": ["h+k h", "h+s h", "h+k h", "h+s h"], "hands": [...] }]; üres, amíg a kép nincs átírva
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  subtitle text not null default '',
  bpm integer not null default 90,
  bars jsonb not null default '[]',
  note text not null default '',
  image_path text,
  file_name text,
  created_at timestamptz not null default now()
);
create index if not exists library_items_category on public.library_items (category, created_at);

alter table public.library_categories enable row level security;
alter table public.library_items enable row level security;

drop policy if exists "library_categories: tanár" on public.library_categories;
create policy "library_categories: tanár" on public.library_categories for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "library_items: tanár" on public.library_items;
create policy "library_items: tanár" on public.library_items for all using (public.is_teacher()) with check (public.is_teacher());
