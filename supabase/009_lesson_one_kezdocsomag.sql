-- BEATHUB, 9. lépés: minden újonnan regisztráló diák kap egy kész órát "Lesson One" néven.
-- A 008_regisztracio_nev_alapjan.sql UTÁN futtasd: SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.
--
-- Tartalma: Gear kvíz, Groove No.1, Money Beat. Akinek már van órája (pl. előre felvett diák), az nem kapja meg,
-- és a már regisztrált diákokat ez a fájl nem érinti.

create or replace function public.give_starter_pack(student uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  lesson uuid;
begin
  if not exists (select 1 from public.profiles where id = student and role = 'student')
     or exists (select 1 from public.lessons where student_id = student) then
    return;
  end if;

  insert into public.lessons (student_id, title) values (student, 'Lesson One') returning id into lesson;

  -- a kotta másolatként az anyaghoz kerül, mert a diák nem látja a tananyag tábláit
  insert into public.materials (student_id, lesson_id, kind, title, ref, note, bars, bpm, position)
  select student, lesson, 'library', x.title, x.ref, x.note, x.bars::jsonb, x.bpm, x.n
  from (values
    (0, 'Gear kvíz', 'hangszerismeret/gear-kviz', 'A dobfelszerelés kilenc hangszere', null, null),
    (1, 'Groove No.1', (select 'grooveok/' || id from public.library_items where lower(title) = 'groove no.1' limit 1), 'Negyedes',
     '[{"beats":["h+k","h+s","h+k","h+s"]}]', 90),
    (2, 'Money Beat', 'grooveok/g1', 'Nyolcados',
     '[{"beats":["h+k h","h+s h","h+k h","h+s h"]}]', 90)
  ) as x(n, title, ref, note, bars, bpm);
end $$;

-- csak a regisztráció hívhatja, az appból nem elérhető
revoke all on function public.give_starter_pack(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  typed text := coalesce(new.raw_user_meta_data->>'full_name', '');
  matches uuid[];
  profile uuid;
begin
  update public.profiles
     set user_id = new.id,
         full_name = case when full_name = '' then typed else full_name end
   where lower(email) = lower(new.email) and user_id is null
  returning id into profile;

  if profile is null and public.name_key(typed) <> '' then
    select array_agg(id) into matches from public.profiles
     where user_id is null and role = 'student' and public.name_key(full_name) = public.name_key(typed);
    if cardinality(matches) = 1 then
      update public.profiles set user_id = new.id, email = lower(new.email) where id = matches[1];
      profile := matches[1];
    end if;
  end if;

  if profile is null then
    insert into public.profiles (user_id, email, full_name) values (new.id, lower(new.email), typed)
    returning id into profile;
  end if;

  -- ha a csomag valamiért nem jön létre, a regisztráció akkor is sikerüljön
  begin
    perform public.give_starter_pack(profile);
  exception when others then
    raise warning 'Lesson One kimaradt (%): %', new.email, sqlerrm;
  end;
  return new;
end $$;

-- ellenőrzés: a függvény megvan, és a Groove No.1 megtalálható a tananyagban (mindkét oszlop true)
select to_regprocedure('public.give_starter_pack(uuid)') is not null as csomag_kesz,
       exists (select 1 from public.library_items where lower(title) = 'groove no.1') as groove_no1_megvan;
