import type { Beats, SongData, SongElement, SongEvent, ElementPart } from './types';

/* Egy dal szerkezete, ahogy a Song Practice tárolja (structure.json → most a songs.structure oszlop), és ami belőle
   a lejátszónak kell. A Song Practice structure.py-jának szerkesztés-oldali része, szó szerint átírva:
   - egy ütem egy minta egy ütemét játssza: 'kulcs' (az első ütemét) vagy 'kulcs@n'; a minták 1, 2 vagy 4 ütemesek;
   - a variáció (variantOf) egy alap elemhez tartozik; a diák az alap elemek alatt látja;
   - toSongData = a régi to_song_block: ugyanaz a SongData, amit a behúzott dalok adtak;
   - regrid / remapSections / compressMap = TEMPÓ ÚJRA (a böngészőben fut, a gép nélkül). */

export type PatternType = 'groove' | 'fill';

export interface Pattern {
  name: string;
  type: PatternType;
  /** 1, 2 vagy 4 ütem */
  len: number;
  /** 4 · len negyed */
  beats: string[];
  /** kézrend negyedenként ('R L - R'), ha van */
  hands?: string[];
  /** variáció: az alap elem kulcsa */
  variantOf?: string;
}

export type BarRef = string | null;

export interface StoredSection {
  name: string;
  from: number;
  to: number;
  tacet: boolean;
  /** a szekció ütemei: minta-hivatkozás vagy null (szünet) */
  bars?: BarRef[];
}

export interface Structure {
  bpm: number;
  offset: number;
  tempo_map: [number, number][];
  downbeats: number[];
  bars: number;
  sections: StoredSection[];
  patterns?: Record<string, Pattern>;
  duration?: number;
}

/* ---------------------------------------------------------------- minta-hivatkozások */

export const plen = (patterns: Record<string, Pattern>, k: string) => Number(patterns[k]?.len) || 1;

export function splitRef(r: string): [string, number] {
  const i = r.indexOf('@');
  if (i < 0) return [r, 1];
  const n = r.slice(i + 1);
  return [r.slice(0, i), /^\d+$/.test(n) ? +n : 1];
}

export function refOk(patterns: Record<string, Pattern>, r: BarRef | undefined): r is string {
  if (!r) return false;
  const [k, n] = splitRef(r);
  return k in patterns && n >= 1 && n <= plen(patterns, k);
}

/** az a G bejegyzés, amit az ütem használ: 1 ütemes mintánál 'kulcs', hosszabbnál 'kulcs@n' */
export function gkey(patterns: Record<string, Pattern>, r: string) {
  const [k, n] = splitRef(r);
  return plen(patterns, k) === 1 ? k : `${k}@${n}`;
}

export function partBeats(patterns: Record<string, Pattern>, r: string) {
  const [k, n] = splitRef(r);
  return patterns[k].beats.slice((n - 1) * 4, n * 4);
}

/** minden ütem minta-hivatkozása a dal sorrendjében (null = szünet). A tacet szekcióba írt beszállás is szól. */
export function flatKeys(s: Structure): BarRef[] {
  const out: BarRef[] = [];
  for (const sec of s.sections) {
    const n = sec.to - sec.from + 1;
    const keys = (sec.bars ?? []).slice(0, n);
    while (keys.length < n) keys.push(null);
    out.push(...keys);
  }
  return out;
}

/* ---------------------------------------------------------------- a lejátszó adatai */

/** Minden egymás utáni fill-ütem (bármelyik fill, a több ütemes fill minden üteme) egy FILL esemény, az első üteme
 *  nevével; beat = ahol az első ütem eltér az előtte lévő groove-tól. */
export function fillEvents(s: Structure, patterns: Record<string, Pattern>): SongEvent[] {
  const flat = flatKeys(s);
  const isFill = (r: BarRef) => refOk(patterns, r) && patterns[splitRef(r)[0]].type === 'fill';
  const events: SongEvent[] = [];
  let i = 0;
  while (i < flat.length) {
    const r = flat[i];
    if (isFill(r)) {
      let j = i;
      while (j + 1 < flat.length && isFill(flat[j + 1])) j++;
      const ev: SongEvent = { name: patterns[splitRef(r!)[0]].name, kind: 'FILL', from: i + 1, to: j + 1 };
      const prev = i ? flat[i - 1] : null;
      if (refOk(patterns, prev)) {
        const x = partBeats(patterns, prev), y = partBeats(patterns, r!);
        let same = 0;
        while (same < 4 && words(x[same]) === words(y[same])) same++;
        if (same > 0 && same < 4) ev.beat = same + 1;
      }
      events.push(ev);
      i = j + 1;
    } else i++;
  }
  return events;
}
const words = (b: string | undefined) => (b ?? '').trim().split(/\s+/).join(' ');

interface ElementEntry {
  key: string;
  name: string;
  len: number;
  loop: [number, number];
  type?: PatternType;
  variants?: ElementEntry[];
}

/** egy groove gyakorlásakor ennyi ütem ismétlődik (ha a dalban ennyiszer szól egymás után): egy periódus, nem egy ütem */
const LOOP_BARS = 8;

/** A diák építőelemei: az alap minták első előfordulásuk sorrendjében, mindegyik egy ismételt ütemtartománnyal
 *  (groove: az első futása, legalább a teljes minta, legfeljebb egy 8 ütemes periódus; fill: az előtte lévő ütem + a fill összes üteme),
 *  és a variációik ugyanígy. */
export function elements(s: Structure, patterns: Record<string, Pattern>): ElementEntry[] {
  const keys = flatKeys(s).map((r) => (refOk(patterns, r) ? splitRef(r)[0] : null));

  const loop = (key: string): [number, number] => {
    const i = keys.indexOf(key), n = plen(patterns, key);
    if (patterns[key].type === 'fill') return [Math.max(1, i), Math.min(keys.length, i + n)];
    let j = i;
    while (j + 1 < keys.length && keys[j + 1] === key && j - i + 1 < Math.max(n, LOOP_BARS)) j++;
    return [i + 1, j + 1];
  };
  const entry = (k: string): ElementEntry => ({ key: k, name: patterns[k].name, len: plen(patterns, k), loop: loop(k) });

  const used = [...new Set(keys.filter((k): k is string => !!k))];
  const out: ElementEntry[] = [];
  for (const k of used) {
    if (patterns[k].variantOf) continue;
    out.push({ ...entry(k), type: patterns[k].type ?? 'groove', variants: used.filter((v) => patterns[v].variantOf === k).map(entry) });
  }
  // egy variáció, aminek az alap eleme magában sehol sem szól, attól még az alap eleme alá kerül
  for (const k of used) {
    const base = patterns[k].variantOf;
    if (base && base in patterns && !out.some((e) => e.key === base)) {
      out.push({
        key: base, name: patterns[base].name, len: plen(patterns, base), loop: loop(k), type: patterns[base].type ?? 'groove',
        variants: used.filter((v) => patterns[v].variantOf === base).map(entry),
      });
    }
  }
  return out;
}

/** a ride-os groove ütemek (a kottán RIDE felirat) */
export function rideBars(s: Structure, patterns: Record<string, Pattern>) {
  const out = new Set<number>();
  flatKeys(s).forEach((r, i) => {
    if (refOk(patterns, r) && patterns[splitRef(r)[0]].type !== 'fill' && partBeats(patterns, r).join(' ').includes('r')) out.add(i + 1);
  });
  return out;
}

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
}

/** A tárolt szerkezetből a lejátszó dala (a régi to_song_block + a behúzott dal fájlja egyben). */
export function toSongData(meta: SongMeta, s: Structure, files: { Drums: string; Band: string }): SongData {
  const patterns = s.patterns ?? {};
  // egy G bejegyzés ütemenként; ugyanaz a tömb minden helyén (a lejátszó azonosság alapján keres benne)
  const G: Record<string, Beats> = { rest: ['-', '-', '-', '-'] };
  for (const [k, p] of Object.entries(patterns)) {
    const n = plen(patterns, k);
    for (let i = 1; i <= n; i++) {
      const bts = p.beats.slice((i - 1) * 4, i * 4), hands = (p.hands ?? []).slice((i - 1) * 4, i * 4);
      G[gkey(patterns, `${k}@${i}`)] = hands.some((h) => /[RL]/.test(h)) ? Object.assign([...bts], { hands }) : [...bts];
    }
  }
  const score: (Beats | null)[] = [null];
  for (const sec of s.sections) {
    const n = sec.to - sec.from + 1;
    const keys = (sec.bars ?? []).map((k) => (refOk(patterns, k) ? gkey(patterns, k) : 'rest'));
    while (keys.length < n) keys.push('rest');
    score.push(...keys.map((k) => G[k]));
  }
  const part = (e: ElementEntry): ElementPart => {
    const refs = Array.from({ length: e.len }, (_, i) => gkey(patterns, `${e.key}@${i + 1}`));
    return { name: e.name, beats: G[refs[0]], ...(refs.length > 1 ? { bars: refs.map((r) => G[r]) } : {}), loop: e.loop };
  };
  return {
    id: meta.id,
    title: meta.title,
    artist: meta.artist,
    info: `${meta.artist ? meta.artist + ' · ' : ''}${s.bpm} BPM · 4/4`,
    tags: ['4/4'],
    bpm: s.bpm,
    offset: s.offset,
    tempoMap: s.tempo_map,
    files,
    sections: s.sections.map((x) => ({ name: x.name, from: x.from, to: x.to, ...(x.tacet ? { tacet: true } : {}) })),
    events: fillEvents(s, patterns),
    score,
    rideBars: rideBars(s, patterns),
    elements: elements(s, patterns).map((e): SongElement => ({ ...part(e), type: e.type!, variants: e.variants!.map(part) })),
  };
}

/* ---------------------------------------------------------------- mentés előtti ellenőrzés (a régi save_structure) */

const BEAT = /^[-chortusfk+ ()>]+$/;

/** A szerkesztő adatai mentésre készen: rossz kézrend és árva variáció kimarad; hibánál üzenetet ad. */
export function cleanStructure(s: Structure): { structure: Structure; error: string } {
  const patterns: Record<string, Pattern> = {};
  for (const [k, p] of Object.entries(s.patterns ?? {})) {
    const q: Pattern = {
      name: String(p.name).trim() || k,
      type: p.type === 'fill' ? 'fill' : 'groove',
      len: Number(p.len) || 1,
      beats: p.beats.map((b) => String(b).trim() || '-'),
      ...(p.variantOf ? { variantOf: String(p.variantOf) } : {}),
      ...(p.hands ? { hands: p.hands.map((h) => String(h).trim() || '-') } : {}),
    };
    // kézrend: minden negyedre R / L / -, különben elhagyva
    if (q.hands && (q.hands.length !== 4 * q.len || !q.hands.every((h) => /^[-RL ]+$/.test(h)))) delete q.hands;
    patterns[k] = q;
  }
  for (const p of Object.values(patterns))
    if (p.variantOf && (!(p.variantOf in patterns) || patterns[p.variantOf].variantOf)) delete p.variantOf;
  for (const [k, p] of Object.entries(patterns))
    if (!/^[\w-]{1,40}$/.test(k) || k === 'rest' || ![1, 2, 4].includes(p.len) || p.beats.length !== 4 * p.len || !p.beats.every((b) => BEAT.test(b)))
      return { structure: s, error: `Hibás minta: ${p.name || k}` };
  const sections = [...s.sections]
    .map((x) => ({
      name: String(x.name).trim() || 'Szekció',
      from: Math.trunc(x.from),
      to: Math.trunc(x.to),
      tacet: !!x.tacet,
      bars: (x.bars ?? []).map((b) => (b && refOk(patterns, b) ? b : null)),
    }))
    .sort((a, b) => a.from - b.from);
  if (sections.some((x) => x.from < 1 || x.to < x.from)) return { structure: s, error: 'Hibás ütemszám: -tól legalább 1, és -tól ≤ -ig.' };
  return { structure: { ...s, sections, patterns }, error: '' };
}

/* ---------------------------------------------------------------- tempó: ütemrács */

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const diffs = (d: number[]) => d.slice(1).map((x, i) => x - d[i]);
const round2 = (x: number) => Math.round(x * 100) / 100;

/** A dal valódi ütemhossza: amiben a legtöbb ütem egyetért (±3%), nem a medián. Szinkópás groove-oknál a felismerő
 *  néha fél vagy háromnegyed ütemet vesz egésznek; ha elég sok ilyen van, a medián elcsúszik (pl. 114 BPM-ből 130). */
export function barLength(downbeats: number[]) {
  const dur = diffs(downbeats);
  if (!dur.length) return 2;
  const agree = dur.map((x) => dur.filter((y) => Math.abs(y - x) <= 0.03 * x).length);
  const x = dur[agree.indexOf(Math.max(...agree))];
  return median(dur.filter((y) => Math.abs(y - x) <= 0.03 * x));
}

/** azok az ütemek, amik több mint tol-lal eltérnek a dal ütemhosszától: ott a klikk rohan vagy lassul */
export function irregularBars(downbeats: number[], tol = 0.08) {
  if (downbeats.length < 3) return [];
  const L = barLength(downbeats);
  return diffs(downbeats).flatMap((x, i) => (Math.abs(x - L) > tol * L ? [i + 1] : []));
}

/** Egyenletes ütemrács a felismert ütemkezdetekre (TEMPÓ ÚJRA). A leghosszabb szabályos futásból indulva egy
 *  ütemhosszal lép előre és hátra; ahol egy felismert ütemkezdet tol-on belül van, oda igazodik, és az ütemhossz
 *  lassan követi (élő, csúszó tempójú daloknál is együtt marad); a köztes (fél / háromnegyed ütemes) jelzéseket átugorja. */
export function regrid(d: number[], tol = 0.06): { grid: number[]; barLen: number } {
  const L0 = barLength(d);
  const ok = diffs(d).map((x) => Math.abs(x - L0) <= tol * L0);
  let best = 0, start = 0, i = 0;
  while (i < ok.length) {
    if (!ok[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < ok.length && ok[j]) j++;
    if (j - i > best) [best, start] = [j - i, i];
    i = j;
  }
  const walk = (t: number, sign: number, limit: number) => {
    const out: number[] = [];
    let L = L0;
    for (;;) {
      let p = t + sign * L;
      if (sign > 0 ? p > limit : p < limit) return out;
      const near = d.filter((x) => Math.abs(x - p) <= tol * L0);
      if (near.length) {
        const q = near.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
        L = Math.min(Math.max(0.8 * L + 0.2 * Math.abs(q - t), 0.9 * L0), 1.1 * L0);
        p = q;
      }
      out.push(p);
      t = p;
    }
  };
  const a = d[start];
  const grid = [...walk(a, -1, d[0] - 0.5 * L0).reverse(), a, ...walk(a, 1, d[d.length - 1] + 0.5 * L0)];
  return { grid: grid.map(round2), barLen: L0 };
}

/** [ütem, mp] pontok: csak azok, amik a lineáris közelítéshez tol másodpercen belül kellenek */
export function compressMap(barTimes: number[], tol = 0.025): [number, number][] {
  const pts = [0];
  let i = 0;
  while (i < barTimes.length - 1) {
    let j = i + 2;
    while (j < barTimes.length) {
      let bad = false;
      for (let k = i; k <= j; k++) {
        const lin = barTimes[i] + ((k - i) / (j - i)) * (barTimes[j] - barTimes[i]);
        if (Math.abs(lin - barTimes[k]) > tol) bad = true;
      }
      if (bad) break;
      j++;
    }
    pts.push(j - 1);
    i = j - 1;
  }
  return pts.map((k) => [k + 1, round2(barTimes[k])]);
}

/** A szekciók és az ütemek kottája új ütemrácsra, idő szerint: minden szekció az új rács legközelebbi ütemén kezdődik,
 *  és minden új ütem a hozzá legközelebbi régi ütem kottáját kapja. */
export function remapSections(sections: StoredSection[], oldDb: number[], newDb: number[]): StoredSection[] {
  const nOld = oldDb.length, nNew = newDb.length;
  const secs = [...sections].sort((a, b) => a.from - b.from);
  const refs: BarRef[] = Array(Math.max(nOld, secs.length ? secs[secs.length - 1].to : 0)).fill(null);
  for (const s of secs)
    (s.bars ?? []).forEach((r, j) => {
      if (s.from - 1 + j < refs.length && j <= s.to - s.from) refs[s.from - 1 + j] = r;
    });
  const nearest = (arr: number[], t: number) => arr.reduce((bi, x, i) => (Math.abs(x - t) < Math.abs(arr[bi] - t) ? i : bi), 0);
  const out: StoredSection[] = [];
  for (const s of secs) {
    const t = oldDb[Math.min(s.from, nOld) - 1];
    let f = nearest(newDb, t) + 1;
    if (out.length && f <= out[out.length - 1].from) f = out[out.length - 1].from + 1;   // két régi szekció egy ütemre esett: a későbbi tovább lép
    if (f > nNew) break;
    out.push({ ...s, from: f });
  }
  out.forEach((s, i) => {
    s.to = i + 1 < out.length ? out[i + 1].from - 1 : nNew;
    s.bars = Array.from({ length: s.to - s.from + 1 }, (_, k) => {
      const o = nearest(oldDb, newDb[s.from - 1 + k]);
      return o < refs.length ? refs[o] : null;
    });
  });
  return out;
}

/** TEMPÓ ÚJRA egy tárolt szerkezeten: új ütemek, BPM, tempótérkép; a szekciók és a kotta átkerülnek. */
export function applyRegrid(s: Structure): Structure {
  const { grid, barLen } = regrid(s.downbeats);
  return {
    ...s,
    sections: remapSections(s.sections, s.downbeats, grid),
    downbeats: grid,
    bars: grid.length,
    offset: grid[0],
    bpm: Math.round(240 / barLen),
    tempo_map: compressMap(grid),
  };
}
