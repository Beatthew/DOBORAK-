-- BEATHUB, 2. lépés: előre felvett diákok + az első diák (Tőth Ádám) az anyagaival.
-- A már lefuttatott schema.sql UTÁN futtasd: SQL Editor → New query → ezt az egészet bemásolni → Run.
-- Többször is futtatható.
--
-- Mi változik: a profil (diák) már a regisztráció ELŐTT létezhet: a tanár név + email alapján felveszi,
-- kiadhat neki órákat és anyagokat, és amikor a diák ugyanazzal az email címmel regisztrál,
-- a fiókja automatikusan ehhez a profilhoz kapcsolódik — mindent ott talál, ami neki ki lett adva.

-- ---------- profilok: a fiók (auth.users) helyett user_id-n keresztül kapcsolódnak ----------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists user_id uuid unique references auth.users on delete set null;
alter table public.profiles add column if not exists email text not null default '';
update public.profiles p set user_id = u.id, email = lower(u.email) from auth.users u where u.id = p.id and p.user_id is null;
create unique index if not exists profiles_email_key on public.profiles (lower(email)) where email <> '';

-- regisztrációkor: ha a tanár már felvette ezt az email címet, ahhoz a profilhoz kapcsolódik
-- (a tanár által megadott név marad); különben új diák-profil jön létre
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set user_id = new.id,
         full_name = case when full_name = '' then coalesce(new.raw_user_meta_data->>'full_name', '') else full_name end
   where lower(email) = lower(new.email) and user_id is null;
  if not found then
    insert into public.profiles (user_id, email, full_name)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'teacher');
$$;

-- a bejelentkezett felhasználó profiljának azonosítója (ehhez kötődnek az órái és anyagai)
create or replace function public.my_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid();
$$;

-- ---------- jogosultságok újra, az új kapcsolódással ----------
drop policy if exists "profiles: saját vagy tanár olvas" on public.profiles;
drop policy if exists "profiles: saját nevet módosít" on public.profiles;
drop policy if exists "profiles: tanár módosít" on public.profiles;
drop policy if exists "profiles: tanár mindent" on public.profiles;
create policy "profiles: saját vagy tanár olvas" on public.profiles for select using (user_id = auth.uid() or public.is_teacher());
create policy "profiles: tanár mindent" on public.profiles for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "lessons: diák olvas" on public.lessons;
create policy "lessons: diák olvas" on public.lessons for select using (student_id = public.my_profile_id() or public.is_teacher());

drop policy if exists "materials: diák olvas" on public.materials;
create policy "materials: diák olvas" on public.materials for select using (student_id = public.my_profile_id() or public.is_teacher());

drop policy if exists "materials bucket: diák a saját mappáját olvassa" on storage.objects;
create policy "materials bucket: diák a saját mappáját olvassa" on storage.objects for select
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = public.my_profile_id()::text);

-- ---------- az első diák: Tőth Ádám, a dobórák app mind a 3 órájával gyakorlatként ----------
insert into public.profiles (email, full_name, role)
select 'pestiyoungster@gmail.com', 'Tőth Ádám', 'student'
where not exists (select 1 from public.profiles where lower(email) = 'pestiyoungster@gmail.com');

insert into public.materials (student_id, kind, ref, created_at)
select p.id, 'exercise', x.ref, now() - (x.n || ' minutes')::interval
from public.profiles p
cross join (values ('1', 3), ('2', 2), ('3', 1)) as x(ref, n)
where lower(p.email) = 'pestiyoungster@gmail.com'
  and not exists (select 1 from public.materials m where m.student_id = p.id and m.kind = 'exercise' and m.ref = x.ref);

-- ellenőrzés: itt látszik minden profil; a te sorodban role = teacher, Ádámnál user_id üres, amíg nem regisztrál
select p.full_name, p.email, p.role, p.user_id is not null as regisztralt,
       (select count(*) from public.materials m where m.student_id = p.id) as anyagok
from public.profiles p order by p.role desc, p.full_name;
