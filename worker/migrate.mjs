// Egyszeri átköltöztetés: a Song Practice projektjei és a BEATHUBba eddig behúzott dalok a Supabase-be.
//   node worker/migrate.mjs --dry   → csak összerakja (worker/migrate-preview.json), nem tölt fel semmit
//   node worker/migrate.mjs         → feltölti (songs tábla + „songs” tárhely); újra futtatva felülírja ugyanazokat
// A BEATHUBban eddig is bent lévő 5 dal a mostani azonosítójával és közzétéve kerül be (az órák hivatkozásai maradnak),
// a többi projekt piszkozatként (csak a tanár látja). A worker/.env kell hozzá (SUPABASE_URL, SUPABASE_SERVICE_KEY).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SP = process.env.SONGPRACTICE_DIR || join(here, '..', '..', 'SONGPRACTICE APP', 'songpractice');
const LIB = join(SP, 'library');
const PUBLISHED_AUDIO = join(here, '..', 'web', 'public', 'songs');
const dry = process.argv.includes('--dry');

/* id: az eddigi BEATHUB azonosító; dir: a Song Practice projekt; block: a publish/index.html blokkja, ha a szerkezet onnan jön
   (a Snow élő változata csak ott van meg: a projektje régebbi). */
const SONGS = [
  { id: 'another-one-bites-the-dust', dir: 'rY0WxgSXdEE', video: 'rY0WxgSXdEE', published: true },
  { id: 'come-together', dir: '45cYwDMibGo', video: '45cYwDMibGo', published: true },
  { id: 'i-ll-hit-you-back', dir: 'm7yF6MJjQzI', video: 'm7yF6MJjQzI', published: true },
  { id: 'skyfall', dir: 'skyfallHand', video: null, published: true },
  { id: 'snow', dir: 'snowHand-01', video: 'p0vM9iINl28', published: true, block: 'snow' },
  { id: 'LHQqqM5sr7g', dir: 'LHQqqM5sr7g', video: 'LHQqqM5sr7g', published: false },
  { id: 'L_XJ_s5IsQc', dir: 'L_XJ_s5IsQc', video: 'L_XJ_s5IsQc', published: false },
  { id: 'Oqt5weEQI-8', dir: 'Oqt5weEQI-8', video: 'Oqt5weEQI-8', published: false },
  // a Snow automatikus elemzése (a közzétett Snow-é a videó azonosító)
  { id: 'p0vM9iINl28', dir: 'p0vM9iINl28', video: null, published: false },
];

// a structure.py split_title-ja
function splitTitle(yt) {
  const clean = yt.replace(/\s*[([][^)\]]*(official|video|lyric|audio|remaster|hd|4k)[^)\]]*[)\]]/gi, '').trim();
  const i = clean.indexOf(' - ');
  return i < 0 ? [clean, ''] : [clean.slice(i + 3).trim(), clean.slice(0, i).trim()];
}

/* a publish/index.html egy dalblokkjából vissza a Song Practice szerkezet (structure.json) */
function structureFromBlock(id) {
  const html = readFileSync(join(SP, 'publish', 'index.html'), 'utf8');
  const m = new RegExp(`/\\* drumsplit:begin ${id} \\*/\\n([\\s\\S]*?)/\\* drumsplit:end ${id} \\*/`).exec(html);
  if (!m) throw new Error(`nincs ilyen blokk: ${id}`);
  const src = m[1];
  let out;
  const body = src
    .replace('const rep =', 'globalThis.__G = G; const rep =')
    .replace('].map(k => k && G[k]);', '];');   // a SCORE kulcsai kellenek, nem a tömbök
  new Function('SONGS', body)({ push: (x) => (out = x) });
  const G = globalThis.__G;
  // minták: G kulcsok (több ütemesnél 'k@n'), a megjegyzésben a felirat
  const labels = Object.fromEntries([...src.matchAll(/^\s*"([^"]+)":.*?\/\/ (.+)$/gm)].map((x) => [x[1], x[2]]));
  const els = [...src.matchAll(/\{ name: ("(?:[^"\\]|\\.)*"), type: "(groove|fill)", beats: G\["([^"]+)"\][^\n]*?variants: \[(.*)\] \}/g)];
  const patterns = {};
  const add = (gk, name, type, variantOf) => {
    const [k, n] = gk.split('@');
    const p = (patterns[k] ??= { name, type, len: 0, beats: [], ...(variantOf ? { variantOf } : {}) });
    const b = G[gk];
    p.len = Math.max(p.len, +(n || 1));
    p.beats.splice((+(n || 1) - 1) * 4, 4, ...b);
    if (b.hands) (p.hands ??= Array(4 * p.len).fill('-')).splice((+(n || 1) - 1) * 4, 4, ...b.hands);
  };
  for (const e of els) {
    const base = e[3].split('@')[0];
    for (const gk of Object.keys(G).filter((k) => k.split('@')[0] === base)) add(gk, JSON.parse(e[1]), e[2]);
    for (const v of e[4].matchAll(/name: ("(?:[^"\\]|\\.)*"), beats: G\["([^"]+)"\]/g)) {
      const vk = v[2].split('@')[0];
      for (const gk of Object.keys(G).filter((k) => k.split('@')[0] === vk)) add(gk, JSON.parse(v[1]), e[2], base);
    }
  }
  for (const gk of Object.keys(G)) {           // a sehol sem használt minták a feliratukkal
    if (gk === 'rest' || patterns[gk.split('@')[0]]) continue;
    const label = labels[gk] || gk;
    add(gk, label.replace(/ \(fill\)$/, '').replace(/ \d+\/\d+$/, ''), / \(fill\)/.test(label) ? 'fill' : 'groove');
  }
  for (const p of Object.values(patterns)) if (p.hands && !p.hands.some((h) => /[RL]/.test(h))) delete p.hands;
  // ütemek: a tempótérképből, ahogy a lejátszó számolja (Timing.barTime)
  const k = out.tempoMap, bar = 240 / out.bpm, bars = out.score.length - 1;
  const barTime = (n) => {
    if (n <= k[0][0]) return k[0][1] + (n - k[0][0]) * bar;
    for (let i = 1; i < k.length; i++) if (n <= k[i][0]) return k[i - 1][1] + ((n - k[i - 1][0]) / (k[i][0] - k[i - 1][0])) * (k[i][1] - k[i - 1][1]);
    return k[k.length - 1][1] + (n - k[k.length - 1][0]) * bar;
  };
  const keys = out.score.slice(1).map((x) => (!x || x === 'rest' ? null : x.includes('@') ? x : x));
  return {
    bpm: out.bpm,
    offset: out.offset,
    tempo_map: out.tempoMap,
    downbeats: Array.from({ length: bars }, (_, i) => Math.round(barTime(i + 1) * 100) / 100),
    bars,
    sections: out.sections.map((s) => ({ name: s.name, from: s.from, to: s.to, tacet: !!s.tacet, bars: keys.slice(s.from - 1, s.to) })),
    patterns,
  };
}

const folders = JSON.parse(readFileSync(join(LIB, 'folders.json'), 'utf8'));
const folderOf = (dir) => folders.find((f) => f.items.includes(dir))?.name ?? null;

const rows = SONGS.map((s) => {
  const meta = JSON.parse(readFileSync(join(LIB, s.dir, 'meta.json'), 'utf8'));
  const [title, artist] = splitTitle(meta.title);
  const structure = s.block ? structureFromBlock(s.block) : JSON.parse(readFileSync(join(LIB, s.dir, 'structure.json'), 'utf8'));
  // a közzétett dalok sávjai azok, amiket a diákok eddig is hallottak
  const audio = (ch) => (s.published && existsSync(join(PUBLISHED_AUDIO, `${s.id}-${ch}.mp3`)) ? join(PUBLISHED_AUDIO, `${s.id}-${ch}.mp3`) : join(LIB, s.dir, `${ch}.mp3`));
  return {
    row: { id: s.id, video_id: s.video, title, artist, status: 'done', progress: 100, error: null, structure, published: s.published, folder: folderOf(s.dir) },
    files: { drums: audio('drums'), band: audio('band') },
  };
});

if (dry) {
  writeFileSync(join(here, 'migrate-preview.json'), JSON.stringify(rows, null, 1));
  for (const { row, files } of rows) console.log(`${row.id.padEnd(28)} ${row.published ? 'közzétéve' : 'piszkozat'}  ${row.title} – ${row.artist}  [${row.folder ?? ''}]  ${files.drums}`);
  process.exit(0);
}

const env = Object.fromEntries(readFileSync(join(here, '.env'), 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const URL = env.SUPABASE_URL?.replace(/\/$/, ''), KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) throw new Error('Hiányzik a worker/.env: SUPABASE_URL és SUPABASE_SERVICE_KEY.');
const H = { apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) };   // az új sb_secret_ kulcs csak apikey fejlécként

for (const { row, files } of rows) {
  for (const [ch, path] of Object.entries(files)) {
    const r = await fetch(`${URL}/storage/v1/object/songs/${row.id}/${ch}.mp3`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' }, body: readFileSync(path),
    });
    if (!r.ok) throw new Error(`${row.id}/${ch}.mp3: ${r.status} ${await r.text()}`);
  }
  const r = await fetch(`${URL}/rest/v1/songs`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`${row.id}: ${r.status} ${await r.text()}`);
  console.log(`feltöltve: ${row.id}`);
}
