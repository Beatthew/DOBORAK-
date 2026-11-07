# BEATHUB

A tanári és a diák felület egy helyen: diákok, órák, tananyag és a Song Practice dalai, bejelentkezéssel (Supabase).

- **Tanár:** a kezdőlapon **Diákjaim** vagy **Tananyag**.
  - *Diákjaim:* diákonként rögzíti az órákat (dátum, cím, jegyzet), és kiad nekik anyagot: órai anyagot
    (fájl / link / jegyzet), dalt a Song Practice-ből, vagy gyakorlatot (kész órát, vagy saját feltöltött gyakorlatot).
    Itt követi a tandíjat is: csomag és óradíj, befizetések, „JÖTT MA” gomb; a pénz ikon jelzi, ha fizetés esedékes.
  - *Tananyag:* bővíthető kategóriák, bennük visszahallgatható kották. Új tétel kézzel építve, vagy képről /
    kottáról átírva (a kép forrásként a tételhez kerül, a kottakódból lesz a kotta). A dalok forrása a Song Practice.
- **Diák:** belépve a saját anyagait látja, három fülön: **Óráim**, **Dalok**, **Gyakorlatok**.

## Mappák

- `web/` – az app (React + Vite). Az oldalak: `pages/`. A tananyag: `data/library.ts` (kategóriák, az eddig
  tanított groove-ok és fillek) és `pages/Library*`. A kész órák tartalma: `data/lessons.ts`.
- `web/src/songs/` – a dalok: a Song Practice motorja (`engine.ts`: lejátszás, lassítás, metronóm; `notation.ts`: kotta),
  a dal szerkezete (`structure.ts`), a szerkesztő logikája (`editorModel.ts`) és a Supabase-ből töltött lista (`store.ts`).
  A dalok a Supabase-ben vannak (`songs` tábla + „songs” tárhely), a **Tananyag → Dalok** oldalon:
  YouTube link beadása → feldolgozás → szerkesztés (szekciók, groove-ok, fillek, kotta) → közzététel a diákoknak.
- `worker/` – a feldolgozó, ami a gépen fut (letöltés, dob/band szétválasztás a GPU-n, ütem- és szekciófelismerés).
  Indítás: `start-worker.bat` (a Song Practice Python környezetét használja). Kell hozzá a `worker/.env`
  (minta: `worker/.env.example`; a Supabase → Project Settings → API Keys → Secret keys kulcsa). Amíg nem fut,
  a beadott linkek sorban várnak.
- `supabase/schema.sql` – adatbázis, tárhely, jogosultságok.
- `assets/` – arculat, a régi dobórák QR-kódjai és drótváza; a `Real Drums Vol. 1` sample-csomag csak helyben van (nincs gitben).

## Supabase beállítása (egyszer)

1. <https://supabase.com> → **New project**. Régió: *Central EU (Frankfurt)*. Az adatbázis jelszavát mentsd el.
2. **SQL Editor** → *New query* → másold be a `supabase/schema.sql` teljes tartalmát → **Run**.
   Utána ugyanígy sorban a `supabase/002_elore_felvett_diakok.sql`-t, a `supabase/003_dobora_az_oraban.sql`-t,
   a `supabase/004_tananyag.sql`-t, a `supabase/005_ora_tananyagbol.sql`-t, a `supabase/007_anyag_sorrend.sql`-t a `supabase/008_regisztracio_nev_alapjan.sql`-t, a `supabase/009_lesson_one_kezdocsomag.sql`-t, a `supabase/010_tandij.sql`-t, a `supabase/011_dalok.sql`-t, a `supabase/012_reszlet_hanggal.sql`-t, a `supabase/013_zarolt_ora_tempotartomany.sql`-t és a `supabase/014_diak_jegyzetek.sql`-t.
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
