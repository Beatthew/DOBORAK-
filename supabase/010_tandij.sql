-- BEATHUB, 10. lépés: tandíj-követő (milyen csomagban jár, mikor mennyit fizetett, hány órát járt le).
-- SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.
-- Csak a tanár látja és írja: a diák a saját tandíjadatait sem éri el.

-- ---------- diákonként: csomag és óradíj ----------
create table if not exists public.student_billing (
  student_id uuid primary key references public.profiles on delete cascade,
  plan text not null default 'pack4' check (plan in ('single', 'pack4')),
  price integer not null default 0 check (price >= 0)
);

-- ---------- befizetések: lessons = hány órát fedez, used_before = ebből hány volt már lejárva a követő indulásakor ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  date date not null default current_date,
  amount integer not null default 0 check (amount >= 0),
  lessons integer not null default 4 check (lessons > 0),
  used_before integer not null default 0 check (used_before >= 0),
  created_at timestamptz not null default now()
);
create index if not exists payments_student on public.payments (student_id, date desc);

-- ---------- megtartott órák ("JÖTT MA"): naponta egy, így a dupla kattintás nem számolódik kétszer ----------
create table if not exists public.attendance (
  student_id uuid not null references public.profiles on delete cascade,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (student_id, date)
);

alter table public.student_billing enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "student_billing: tanár" on public.student_billing;
create policy "student_billing: tanár" on public.student_billing for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "payments: tanár" on public.payments;
create policy "payments: tanár" on public.payments for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "attendance: tanár" on public.attendance;
create policy "attendance: tanár" on public.attendance for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- a táblázat eddigi adatai: névrészek alapján (ékezet és sorrend nem számít), csak ha még nincs befizetése ----------
-- Laszlo Dorkánál a táblázatban nincs nap, ezért október 1. szerepel.
with sheet (first_part, last_part, price, paid_on, amount, used_before) as (
  values
    ('laszlo', 'dorka', 10000, date '2026-10-01', 40000, 1),
    ('hartai', 'kata', 10000, date '2026-10-30', 40000, 1),
    ('fabio', 'frescia', 12000, date '2026-10-31', 48000, 1),
    ('toth', 'adam', 10000, date '2026-10-20', 40000, 3)
),
matched as (
  select p.id, s.*
  from sheet s
  join public.profiles p
    on p.role = 'student'
   and translate(lower(p.full_name), 'áéíóöőúüű', 'aeiooouuu') like '%' || s.first_part || '%'
   and translate(lower(p.full_name), 'áéíóöőúüű', 'aeiooouuu') like '%' || s.last_part || '%'
),
billing as (
  insert into public.student_billing (student_id, plan, price)
  select id, 'pack4', price from matched
  on conflict (student_id) do nothing
)
insert into public.payments (student_id, date, amount, lessons, used_before)
select m.id, m.paid_on, m.amount, 4, m.used_before
from matched m
where not exists (select 1 from public.payments x where x.student_id = m.id);

-- ellenőrzés: kinek van már beállítva a tandíja (akit a fenti nem talált meg, az appban egy kattintással felvehető)
select p.full_name, b.plan, b.price, x.date as utolso_befizetes, x.amount, x.used_before
from public.profiles p
left join public.student_billing b on b.student_id = p.id
left join lateral (select * from public.payments y where y.student_id = p.id order by y.date desc limit 1) x on true
where p.role = 'student'
order by p.full_name;
