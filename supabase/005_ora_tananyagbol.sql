-- BEATHUB, 5. lépés: egy órához tananyagot lehet válogatni. A diák nem látja a tananyag tábláit,
-- ezért a kiválasztott tétel kottája másolatként az anyaghoz kerül (a tananyag későbbi törlése sem viszi el).
-- SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.

alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials add constraint materials_kind_check
  check (kind in ('material', 'song', 'exercise', 'library'));

-- ref: '<kategória>/<tétel id>'; bars: a kotta ütemei, mint a library_items.bars
alter table public.materials add column if not exists bars jsonb;
alter table public.materials add column if not exists bpm integer;
