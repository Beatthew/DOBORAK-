// A Song Practice appot (../../SONGPRACTICE APP/songpractice-netlify) bemásolja a public/dalok mappába,
// és a dalok listáját (id, cím, előadó) kiírja a src/data/songs.json-ba a tanári dal-választóhoz.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const from = process.env.SONGPRACTICE_DIR || join(web, '..', '..', 'SONGPRACTICE APP', 'songpractice-netlify');
const to = join(web, 'public', 'dalok');

if (!existsSync(join(from, 'index.html'))) {
  if (existsSync(join(to, 'index.html'))) {
    console.log(`sync-songs: nincs forrás (${from}), a meglévő public/dalok marad.`);
    process.exit(0);
  }
  console.error(`sync-songs: nem található a Song Practice app: ${from}`);
  process.exit(1);
}

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true, filter: (p) => !/[\/]\.git([\/]|$)/.test(p) });

const html = readFileSync(join(from, 'index.html'), 'utf8');
const songs = [...html.matchAll(/id: '([^']+)', title: "([^"]*)", artist: "([^"]*)"/g)].map(([, id, title, artist]) => ({ id, title, artist }));
writeFileSync(join(web, 'src', 'data', 'songs.json'), JSON.stringify(songs, null, 2) + '\n');
console.log(`sync-songs: ${songs.length} dal → public/dalok`);
