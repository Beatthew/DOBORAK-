-- BEATHUB, 6. lépés: az első óra (az Alapok kottalap anyaga) Dorkának, Szilvinek, Katának és Fábiónak.
-- A 005_ora_tananyagbol.sql UTÁN futtasd: SQL Editor → New query → ezt az egészet bemásolni → Run.
-- Többször is futtatható: akinek már van órája, azt nem bántja.

-- A negyedes groove és fill még nincs a beépített tananyagban: ide kerül, ha még nincs meg.
insert into public.library_items (category, title, subtitle, bars)
select x.category, x.title, 'Negyedes', x.bars::jsonb
from (values
  ('grooveok', 'Groove No.1', '[{"beats":["h+k","h+s","h+k","h+s"]}]'),
  ('fillek', 'Fill No.1', '[{"beats":["s","s","s","s"],"hands":["R","L","R","L"]}]')
) as x(category, title, bars)
where not exists (select 1 from public.library_items i where lower(i.title) = lower(x.title));

do $$
declare
  who record;
  matches uuid[];
  lesson uuid;
begin
  for who in
    select * from (values ('Dorka', '(^|\s)Dorka'), ('Szilvi', '(^|\s)Szilvi'), ('Kata', '(^|\s)Kata'), ('Fábió', '(^|\s)F[aá]bi[oó]')) as x(name, pattern)
  loop
    select array_agg(id) into matches from public.profiles where role = 'student' and full_name ~* who.pattern;
    if coalesce(cardinality(matches), 0) <> 1 then
      raise warning '% kimaradt: % találat a diákok között.', who.name, coalesce(cardinality(matches), 0);
      continue;
    end if;
    if exists (select 1 from public.lessons where student_id = matches[1]) then
      raise notice '% kimaradt: már van órája.', who.name;
      continue;
    end if;

    insert into public.lessons (student_id, title) values (matches[1], '1. óra') returning id into lesson;

    -- a kotta másolatként az anyaghoz kerül, mert a diák nem látja a tananyag tábláit
    insert into public.materials (student_id, lesson_id, kind, title, ref, note, bars, bpm, created_at)
    select matches[1], lesson, 'library', x.title, x.ref, x.note, x.bars::jsonb, 90, now() + (x.n || ' seconds')::interval
    from (values
      (0, 'Groove No.1', (select 'grooveok/' || id from public.library_items where lower(title) = 'groove no.1' limit 1), 'Negyedes',
       '[{"beats":["h+k","h+s","h+k","h+s"]}]'),
      (1, 'Fill No.1', (select 'fillek/' || id from public.library_items where lower(title) = 'fill no.1' limit 1), 'Negyedes',
       '[{"beats":["s","s","s","s"],"hands":["R","L","R","L"]}]'),
      (2, 'Money Beat', 'grooveok/g1', 'Nyolcados',
       '[{"beats":["h+k h","h+s h","h+k h","h+s h"]}]'),
      (3, 'Fill No.2', 'fillek/f3', 'Körbe a dobon',
       '[{"beats":["s s","t t","u u","f f"],"hands":["R L","R L","R L","R L"]}]')
    ) as x(n, title, ref, note, bars);
  end loop;
end $$;

-- ellenőrzés: négy diák, mindegyiknél 1 óra és 4 anyag
select p.full_name, p.email,
       (select count(*) from public.lessons l where l.student_id = p.id) as orak,
       (select count(*) from public.materials m where m.student_id = p.id and m.kind = 'library') as anyagok
from public.profiles p
where p.role = 'student' and p.full_name ~* '(^|\s)(Dorka|Szilvi|Kata|F[aá]bi[oó])'
order by p.full_name;
