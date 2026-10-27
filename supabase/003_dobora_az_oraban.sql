-- Beatthew – Diákjaim, 3. lépés: egy órához hozzá lehet kötni a dobórák app egyik óráját.
-- SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.

-- az óra anyaga a dobórák appból: az ottani óra száma (pl. '2'), vagy üres
alter table public.lessons add column if not exists doborak text;

-- Tőth Ádám: a dobórák 3 órája órákként jelenjen meg (az Órák fülön), ne gyakorlatként.
-- A dátumok csak sorrendet tartanak (heti távolságra, a mai nappal végződve) — az appban átírhatók.
insert into public.lessons (student_id, date, title, doborak)
select p.id, current_date - x.weeks * 7, x.ref || '. óra', x.ref
from public.profiles p
cross join (values ('1', 2), ('2', 1), ('3', 0)) as x(ref, weeks)
where lower(p.email) = 'pestiyoungster@gmail.com'
  and not exists (select 1 from public.lessons l where l.student_id = p.id and l.doborak = x.ref);

delete from public.materials m
using public.profiles p
where m.student_id = p.id and lower(p.email) = 'pestiyoungster@gmail.com'
  and m.kind = 'exercise' and m.ref in ('1', '2', '3') and m.lesson_id is null;

-- ellenőrzés: Ádám órái
select l.date, l.title, l.doborak
from public.lessons l join public.profiles p on p.id = l.student_id
where lower(p.email) = 'pestiyoungster@gmail.com' order by l.date;
