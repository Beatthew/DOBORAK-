-- BEATHUB, 15. lépés: „Új” jelzés a diáknak. Amíg a diák nem nyitotta meg a fület (Dalok / Gyakorlatok),
-- a frissen kiadott anyag seen_at mezője üres: ezt jelzi a fül és a kártya. A diák a materials sort nem írhatja,
-- ezért egy függvény jelöli látottnak a saját anyagait.
-- Többször is futtatható.

alter table public.materials add column if not exists seen_at timestamptz;

-- ami a bevezetés előtt ki volt adva, azt már látta (kivéve Tőth Ádám ritmusskáláját: az az első új gyakorlat)
update public.materials set seen_at = created_at
where seen_at is null and created_at < '2026-11-14 13:56:00+00' and ref is distinct from 'ritmusgyakorlatok/ritmusskala';

create or replace function public.mark_materials_seen(ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.materials set seen_at = now()
  where id = any(ids) and student_id = auth.uid() and seen_at is null;
$$;

revoke all on function public.mark_materials_seen(uuid[]) from public;
grant execute on function public.mark_materials_seen(uuid[]) to authenticated;
