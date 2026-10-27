# Beatthew – Diákjaim

A dobórák app és a Song Practice összevonása, bejelentkezéssel (Supabase).

- **Tanár:** látja az összes regisztrált diákot, diákonként rögzíti az órákat (dátum, cím, jegyzet),
  és kiad nekik anyagot: órai anyagot (fájl / link / jegyzet), dalt a Song Practice-ből, vagy gyakorlatot
  (egy dobórát, vagy saját feltöltött gyakorlatot).
- **Diák:** belépve a saját anyagait látja, három fülön: **Óráim**, **Dalok**, **Gyakorlatok**.

## Mappák

- `web/` – az app (React + Vite). A dobórák kódja `src/` alatt, az új oldalak: `pages/Login`, `pages/StudentHome`,
  `pages/TeacherHome`, `pages/TeacherStudent`.
- `web/src/songs/` – a dalok: a Song Practice motorja (`engine.ts`: lejátszás, lassítás, metronóm; `notation.ts`: kotta)
  és a behúzott dalok kottája (`data/`). A hangsávok: `web/public/songs/`.
  **Új dal behúzása** a Song Practice-ből (ami ott új, attól még nem kerül ide):
  `cd web` → `npm run import-song -- <dal id>` (pl. `npm run import-song -- skyfall`). Újra behúzva frissül.
- `supabase/schema.sql` – adatbázis, tárhely, jogosultságok.

## Supabase beállítása (egyszer)

1. <https://supabase.com> → **New project**. Régió: *Central EU (Frankfurt)*. Az adatbázis jelszavát mentsd el.
2. **SQL Editor** → *New query* → másold be a `supabase/schema.sql` teljes tartalmát → **Run**.
   Utána ugyanígy sorban a `supabase/002_elore_felvett_diakok.sql`-t és a `supabase/003_dobora_az_oraban.sql`-t.
3. **Authentication → Sign In / Providers → Email**: legyen bekapcsolva. A *Confirm email* opcióval döntöd el,
   hogy a diáknak meg kell-e erősítenie az email címét regisztráció után.
4. **Project Settings → API** (vagy *Data API* / *API Keys*): kell a **Project URL** és az **anon public** kulcs.
   Ezeket írd be a `web/.env.local` fájlba (minta: `web/.env.example`).
5. Indítsd el az appot (`cd web`, `npm install`, `npm run dev`), és **regisztrálj** a saját email címeddel.
6. Tedd magad tanárrá: SQL Editorban futtasd (a saját email címeddel):

   ```sql
   update public.profiles set role = 'teacher' where lower(email) = lower('IDE@AZ.EMAILED');
   ```

   Lépj ki és be: a kezdőlapon már a diákjaid listája jelenik meg.

## Netlify

Új GitHub repó → Netlify *Add new site → Import from Git*. A `netlify.toml` mindent beállít; a Netlify felületén
add meg környezeti változóként: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Supabase → **Authentication → URL Configuration → Site URL**: a Netlify-os cím (hogy a megerősítő email oda vigyen).
