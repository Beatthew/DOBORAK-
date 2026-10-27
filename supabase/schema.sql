-- Beatthew – Diákjaim: adatbázis + tárhely + jogosultságok.
-- Futtatás: Supabase → SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.
-- Utána futtasd a 002_elore_felvett_diakok.sql-t is (előre felvehető diákok).

-- ---------- profilok: minden bejelentkezett felhasználó (diák vagy tanár) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

-- regisztrációkor automatikusan létrejön a profil (diákként), a regisztrációs űrlapon megadott névvel
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- ---------- órák: egy diák egy órája (dátum, cím, jegyzet) ----------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  date date not null default current_date,
  title text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- anyagok: amit a tanár egy diáknak kiad ----------
-- kind: 'material' = órai anyag (fájl / link / jegyzet), 'song' = dal a Song Practice-ből (ref = dal id),
--       'exercise' = technikai gyakorlat (ref = dobórák óra száma, vagy feltöltött fájl)
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  lesson_id uuid references public.lessons on delete set null,
  kind text not null check (kind in ('material', 'song', 'exercise')),
  title text not null default '',
  ref text,
  file_path text,
  file_name text,
  link_url text,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists materials_student on public.materials (student_id, created_at desc);
create index if not exists lessons_student on public.lessons (student_id, date desc);

-- ---------- jogosultságok (RLS): a tanár mindent lát és szerkeszt, a diák csak a sajátját látja ----------
alter table public.profiles enable row level security;
alter table public.lessons enable row level security;
alter table public.materials enable row level security;

drop policy if exists "profiles: saját vagy tanár olvas" on public.profiles;
create policy "profiles: saját vagy tanár olvas" on public.profiles for select using (id = auth.uid() or public.is_teacher());
drop policy if exists "profiles: saját nevet módosít" on public.profiles;
create policy "profiles: saját nevet módosít" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
drop policy if exists "profiles: tanár módosít" on public.profiles;
create policy "profiles: tanár módosít" on public.profiles for update using (public.is_teacher());

drop policy if exists "lessons: diák olvas" on public.lessons;
create policy "lessons: diák olvas" on public.lessons for select using (student_id = auth.uid() or public.is_teacher());
drop policy if exists "lessons: tanár ír" on public.lessons;
create policy "lessons: tanár ír" on public.lessons for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "materials: diák olvas" on public.materials;
create policy "materials: diák olvas" on public.materials for select using (student_id = auth.uid() or public.is_teacher());
drop policy if exists "materials: tanár ír" on public.materials;
create policy "materials: tanár ír" on public.materials for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- tárhely: feltöltött anyagok, diákonként mappában (<diák id>/<fájl>) ----------
insert into storage.buckets (id, name, public) values ('materials', 'materials', false) on conflict (id) do nothing;

drop policy if exists "materials bucket: tanár mindent" on storage.objects;
create policy "materials bucket: tanár mindent" on storage.objects for all
  using (bucket_id = 'materials' and public.is_teacher()) with check (bucket_id = 'materials' and public.is_teacher());
drop policy if exists "materials bucket: diák a saját mappáját olvassa" on storage.objects;
create policy "materials bucket: diák a saját mappáját olvassa" on storage.objects for select
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- a tanári fiók beállítása ----------
-- Miután regisztráltál az appban (és a 002-es fájl is lefutott), futtasd ezt a saját email címeddel:
--   update public.profiles set role = 'teacher' where lower(email) = lower('IDE@AZ.EMAILED');
