-- BEATHUB, 14. lépés: jegyzetek diákonként (mi történt az órán, mire készüljön a következőre).
-- A diák oldalán, az órák fölött írja a tanár; csak a tanár látja.
-- Többször is futtatható.

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_notes_student on public.student_notes (student_id, created_at desc);

drop trigger if exists student_notes_touch on public.student_notes;
create trigger student_notes_touch before update on public.student_notes for each row execute function public.touch_updated_at();

alter table public.student_notes enable row level security;
drop policy if exists "student_notes: tanár" on public.student_notes;
create policy "student_notes: tanár" on public.student_notes for all using (public.is_teacher()) with check (public.is_teacher());
