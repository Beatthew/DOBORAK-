-- BEATHUB, 13. lépés:
-- 1. Zárolt óra: előre elkészített óra, amit a diák lát a listájában, de még nem nyithat meg (a tanár oldja fel).
--    A zárolt óra anyagait a diák az adatbázisból sem olvashatja.
-- 2. Tempótartomány egy gyakorlathoz: a lejátszó tempócsúszkája bpm_min és bpm_max között mozog (pl. 65–100).
-- Többször is futtatható.

alter table public.lessons add column if not exists locked boolean not null default false;

alter table public.library_items add column if not exists bpm_min integer;
alter table public.library_items add column if not exists bpm_max integer;
alter table public.materials add column if not exists bpm_min integer;
alter table public.materials add column if not exists bpm_max integer;

drop policy if exists "materials: diák olvas" on public.materials;
create policy "materials: diák olvas" on public.materials for select using (
  public.is_teacher()
  or (student_id = public.my_profile_id()   -- mint a 002-ben: az előre felvett diák profilja nem az auth id
      and not exists (select 1 from public.lessons l where l.id = materials.lesson_id and l.locked))
);
