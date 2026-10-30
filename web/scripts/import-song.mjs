// Dal behúzása a Song Practice-ből a BEATHUBba („húzd bele”):
//   node scripts/import-song.mjs come-together skyfall …
// A Song Practice index.html-jéből kimásolja a dal blokkját (kotta, szekciók, elemek, tempótérkép)
// a src/songs/<id>.ts fájlba, a két hangsávot a public/songs mappába, és frissíti a src/songs/index.ts listát.
// Ugyanazt a dalt újra behúzva frissül (pl. ha a Song Practice-ben javítottál a kottáján).
// Ami a Song Practice-ben új, attól még NEM kerül ide: csak az, amit így behúzol.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
// a Songpractice app „KÜLDÉS A BEATHUBBA” gombja ide teszi a dalokat
const from = process.env.SONGPRACTICE_DIR || join(web, '..', '..', 'SONGPRACTICE APP', 'songpractice', 'publish');
const html = readFileSync(join(from, 'index.html'), 'utf8');
const songsDir = join(web, 'src', 'songs', 'data');
const audioDir = join(web, 'public', 'songs');
mkdirSync(songsDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

const ids = process.argv.slice(2);
if (!ids.length) {
  const all = [...html.matchAll(/drumsplit:begin (\S+) \*\//g)].map((m) => m[1]);
  console.log(`Használat: node scripts/import-song.mjs <dal id> …\nA Song Practice dalai: ${all.join(', ')}`);
  process.exit(1);
}

for (const id of ids) {
  const m = new RegExp(`/\\* drumsplit:begin ${id} \\*/\\n([\\s\\S]*?)/\\* drumsplit:end ${id} \\*/`).exec(html);
  if (!m) {
    console.error(`Nincs ilyen dal a Song Practice-ben: ${id}`);
    process.exitCode = 1;
    continue;
  }
  const body = m[1].replace('SONGS.push((() => {', 'const song: SongData = (() => {').replace(/\}\)\(\)\);\s*$/, '})();\n');
  writeFileSync(
    join(songsDir, `${id}.ts`),
    `// @ts-nocheck — a Song Practice-ből behúzva (scripts/import-song.mjs). A kottát ott szerkeszd, majd húzd be újra.\n` +
      `import type { SongData } from '../types';\n\n${body}\nexport default song;\n`,
  );
  for (const f of new Set([...body.matchAll(/'([^']+\.mp3)'/g)].map((x) => x[1]))) {
    if (!existsSync(join(from, f))) throw new Error(`Hiányzó hangfájl: ${f}`);
    copyFileSync(join(from, f), join(audioDir, f));
  }
  console.log(`behúzva: ${id}`);
}

// a lista mindig a src/songs/data mappa tartalmából épül
const files = readdirSync(songsDir).filter((f) => f.endsWith('.ts')).sort();
const name = (f) => 's_' + f.replace(/\.ts$/, '').replace(/\W/g, '_');
writeFileSync(
  join(web, 'src', 'songs', 'index.ts'),
  `// Automatikusan generált (scripts/import-song.mjs) — a BEATHUBba behúzott dalok.\nimport type { SongData } from './types';\n` +
    files.map((f) => `import ${name(f)} from './data/${f.replace(/\.ts$/, '')}';`).join('\n') +
    `\n\nexport const SONGS: SongData[] = [${files.map(name).join(', ')}];\nexport const findSongData = (id: string | null | undefined) => SONGS.find((s) => s.id === id);\n`,
);
console.log(`dalok a BEATHUBban: ${files.length}`);
