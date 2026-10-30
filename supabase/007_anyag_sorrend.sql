-- BEATHUB, 7. lépés: az órához csatolt anyagok sorrendje (az óra szerkesztésekor húzogatással állítható).
-- SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.

alter table public.materials add column if not exists position integer;

-- a meglévő órák anyagai a felvétel sorrendjében kapnak helyet
update public.materials m
   set position = x.n
  from (
    select id, row_number() over (partition by lesson_id order by created_at, ctid) - 1 as n
    from public.materials
    where lesson_id is not null
  ) x
 where m.id = x.id and m.position is null;
