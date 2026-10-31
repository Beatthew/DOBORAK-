-- BEATHUB, 8. lépés: a regisztráció a név alapján is megtalálja az előre felvett diákot.
-- SQL Editor → New query → ezt az egészet bemásolni → Run. Többször is futtatható.
--
-- Sorrend: 1) email egyezés, 2) ha nincs, név egyezés a még nem regisztrált diákok között, 3) ha nincs, új profil.
-- A névnél a kis- és nagybetű, az ékezet és a szórend nem számít. Ha két diákra is illene, új profil jön létre.
-- Figyelem: aki beírja egy még nem regisztrált diák nevét, az megkapja a profilját. Ha ezt már nem akarod,
-- futtasd újra a 002 handle_new_user részét: az csak email alapján kapcsol.

create or replace function public.name_key(n text) returns text
language sql immutable set search_path = public as $$
  select coalesce(string_agg(w, ' ' order by w), '')
  from regexp_split_to_table(translate(lower(trim(coalesce(n, ''))), 'áéíóöőúüű', 'aeiooouuu'), '\s+') as w;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  typed text := coalesce(new.raw_user_meta_data->>'full_name', '');
  matches uuid[];
begin
  update public.profiles
     set user_id = new.id,
         full_name = case when full_name = '' then typed else full_name end
   where lower(email) = lower(new.email) and user_id is null;
  if found then
    return new;
  end if;

  if public.name_key(typed) <> '' then
    select array_agg(id) into matches from public.profiles
     where user_id is null and role = 'student' and public.name_key(full_name) = public.name_key(typed);
    if cardinality(matches) = 1 then
      update public.profiles set user_id = new.id, email = lower(new.email) where id = matches[1];
      return new;
    end if;
  end if;

  insert into public.profiles (user_id, email, full_name) values (new.id, lower(new.email), typed);
  return new;
end $$;

-- ellenőrzés: ha valaki már a saját, üres profiljába regisztrált, itt két sorban látszik a neve
select p.full_name, p.email, p.user_id is not null as regisztralt,
       (select count(*) from public.lessons l where l.student_id = p.id) as orak,
       (select count(*) from public.materials m where m.student_id = p.id) as anyagok
from public.profiles p where p.role = 'student' order by public.name_key(p.full_name), p.created_at;
