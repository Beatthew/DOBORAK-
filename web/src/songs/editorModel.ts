import { cleanStructure, elements, type BarRef, type Pattern, type PatternType, type Structure } from './structure';

/* A dal szerkesztője, felület nélkül: a Song Practice szerkesztőjének (index.html) logikája szó szerint.

   Szekciók: blokkok rendezett listája. A kotta a dal ütemeihez tartozik (a 47. ütem a 47. marad); a lista csak
   határokat húz rájuk. Minden blokk a HOSSZÁT tárolja, a -tól/-ig a sorrendből jön, és a blokkok mindig az egész
   dalt lefedik. Egy határ mozgatása két szomszéd között mozog: a hangok a helyükön maradnak, a dal hossza nem változik.

   Minták: patterns[kulcs] = { name, type, len (1, 2 vagy 4 ütem), beats (4 × len negyed), hands?, variantOf? }.
   Egy ütem arra hivatkozik, amit játszik: 'kulcs' (= az 1. üteme) vagy 'kulcs@2'… Variáció nélküli minta = alap elem:
   a GROOVE/FILLS fülön szerkesztve minden ütem változik, ami használja. A SONG fülön szerkesztve az alap elem nem
   változik: az a hely saját variációt kap (variantOf = az alap), v1, v2 … néven. */

export interface Block {
  name: string;
  tacet: boolean;
  len: number;
  bars: BarRef[];
}

export type Tab = PatternType | 'song';
export type Mark = '' | '>' | 'g';

export const INST: [string, string][] = [
  ['c', 'CRASH'], ['r', 'RIDE'], ['o', 'NYITOTT HH'], ['h', 'HIHAT'], ['t', 'TAM'], ['u', 'KÖZÉP TAM'], ['s', 'PERGŐ'], ['f', 'ÁLLÓ TAM'], ['k', 'LÁBDOB'],
];
const ORDER = 'crohtusfk';
export const LENS = [1, 2, 4];
export const SUBDIV: [number, string][] = [[1, 'negyed'], [2, '8-ad'], [3, 'triola'], [4, '16-od'], [6, 'szextola']];
const NEXT_MARK: Record<string, Mark | undefined> = { '': '>', '>': 'g' };   // kattintás: hang → akcentus → ghost → (törlés)

export const keyOf = (r: BarRef | undefined) => (r ? r.split('@')[0] : null);
export const partOf = (r: BarRef | undefined) => (r ? +(r.split('@')[1] || 1) : 0);
export const refOf = (k: string, n: number) => (n <= 1 ? k : `${k}@${n}`);

/* egy negyed ↔ tagok: minden tag egy Map hangszer → jelölés ('' sima, '>' akcentus, 'g' ghost);
   a szövegben az akcentus 's>', a ghost '(s)' */
const parseTok = (tok: string): [string, Mark] => [tok.replace(/[()>]/g, ''), /^\(.*\)$/.test(tok) ? 'g' : tok.endsWith('>') ? '>' : ''];
export const parseBeat = (str: string) => str.trim().split(/\s+/).map((sl) => new Map<string, Mark>(sl === '-' ? [] : sl.split('+').map(parseTok)));
const serBeat = (slots: Map<string, Mark>[]) =>
  slots.map((m) => (m.size ? [...m].sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b)).map(([ins, mod]) => (mod === 'g' ? `(${ins})` : ins + mod)).join('+') : '-')).join(' ');

/** az ütemek elejei (mp) alapján: melyik ütemben van t (1-től; 0 = az 1. ütem előtt) */
export function barAtTime(downbeats: number[], t: number) {
  let lo = 0, hi = downbeats.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (downbeats[m] <= t + 0.01) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export class EditorModel {
  S: Structure;
  blocks: Block[] = [];
  patterns: Record<string, Pattern> = {};
  tab: Tab = 'groove';
  selPat: string | null = null;
  /** a SONG fülön kijelölt ütem a mutatott szekción belül */
  selBar = -1;
  shownBlock = 0;
  private hist: string[] = [];
  private hpos = -1;
  private histAt = 0;

  constructor(s: Structure) {
    this.S = s;
    this.load(s);
  }

  /** a tárolt szekciók → blokkok; egy blokk a következő elejéig tart, így a régi adatok rései / átfedései
   *  elnyelődnek anélkül, hogy bármelyik szekció eleje elmozdulna */
  load(s: Structure) {
    this.S = s;
    const secs = [...s.sections].sort((a, b) => a.from - b.from);
    this.patterns = JSON.parse(JSON.stringify(s.patterns ?? {}));
    // minden tárolt ütem a dal idővonalán a saját helyére kerül
    const n = Math.max(s.bars, secs.length ? secs[secs.length - 1].to : 0);
    const all: BarRef[] = Array(n).fill(null);
    secs.forEach((x) => (x.bars ?? []).forEach((k, j) => {
      if (x.from - 1 + j < n && j <= x.to - x.from) all[x.from - 1 + j] = k;
    }));
    this.blocks = secs.map((x, i) => ({
      name: x.name, tacet: !!x.tacet, bars: [],
      len: Math.max(1, (i + 1 < secs.length ? secs[i + 1].from : x.to + 1) - x.from),
    }));
    if (secs.length && secs[0].from > 1) this.blocks[0].len += secs[0].from - 1;
    if (this.blocks.length && this.totalBars() < n) this.blocks[this.blocks.length - 1].len += n - this.totalBars();   // az egész dalt lefedi
    this.reslice(all);
    this.hist = [this.snapshot()];   // a visszavonás a megnyitáskori állapotig megy
    this.hpos = 0;
    this.histAt = 0;
    this.selPat = Object.keys(this.patterns).find((k) => this.patterns[k].type === this.tab) ?? null;
    this.shownBlock = 0;
    this.selBar = -1;
  }

  /* ---------------------------------------------------------------- ütemek és szekciók */

  flatBars = () => this.blocks.flatMap((b) => b.bars);
  totalBars = () => this.blocks.reduce((n, b) => n + b.len, 0);
  spans() {
    let f = 1;
    return this.blocks.map((b) => {
      const s = { from: f, to: f + b.len - 1 };
      f += b.len;
      return s;
    });
  }
  reslice(all: BarRef[]) {
    let f = 0;
    this.blocks.forEach((b) => {
      b.bars = all.slice(f, f + b.len);
      while (b.bars.length < b.len) b.bars.push(null);
      f += b.len;
    });
  }
  barStart = (n: number) => (n <= 1 ? 0 : this.S.downbeats[Math.min(n, this.S.downbeats.length) - 1]);
  barAt = (t: number) => barAtTime(this.S.downbeats, t);
  /** a szekció, amiben az ütem van (az 1. ütem előtt: az első) */
  blockAtBar(bar: number) {
    const i = this.spans().findIndex((s) => bar >= s.from && bar <= s.to);
    return i;
  }

  rename(i: number, name: string) {
    this.blocks[i].name = name;
  }
  setTacet(i: number, on: boolean) {
    this.blocks[i].tacet = on;
  }
  /** -ig: a KÖVETKEZŐ szekcióval közös határt mozgatja; az utolsó szekció vége a dal vége */
  setTo(i: number, to: number) {
    const all = this.flatBars(), sp = this.spans();
    if (i === this.blocks.length - 1) {
      this.blocks[i].len = Math.max(1, (to || sp[i].to) - sp[i].from + 1);
      all.length = Math.min(all.length, this.totalBars());
    } else {
      const t = Math.min(Math.max(to || sp[i].to, sp[i].from), sp[i + 1].to - 1);
      const d = t - sp[i].to;
      this.blocks[i].len += d;
      this.blocks[i + 1].len -= d;
    }
    this.reslice(all);
  }
  /** -tól: az ELŐZŐ szekcióval közös határt mozgatja; ennek a vége marad */
  setFrom(i: number, from: number) {
    if (i === 0) return;
    const all = this.flatBars(), sp = this.spans(), prev = sp[i - 1];
    const f = Math.min(Math.max(from || sp[i].from, prev.from + 1), sp[i].to);
    const d = f - sp[i].from;
    this.blocks[i - 1].len += d;
    this.blocks[i].len -= d;
    this.reslice(all);
  }
  /** ×: a szekció beleolvad az előzőbe (az első a következőbe); egy ütem sem mozdul */
  mergeBlock(i: number) {
    if (this.blocks.length < 2) return;
    const all = this.flatBars(), into = i > 0 ? i - 1 : 1;
    this.blocks[into].len += this.blocks[i].len;
    this.blocks.splice(i, 1);
    this.reslice(all);
  }
  /** + SZEKCIÓ: a lejátszott szekció kettéválik az aktuális ütemnél (vagy félbe); az ütemek kottája marad.
   *  Visszaadja az új szekció indexét, vagy -1-et, ha túl rövid. */
  splitBlock(bar: number) {
    const all = this.flatBars(), sp = this.spans();
    bar = Math.max(1, bar);
    let i = sp.findIndex((s) => bar >= s.from && bar <= s.to);
    if (i < 0) i = this.blocks.length - 1;
    const at = bar > sp[i].from ? bar : sp[i].from + Math.floor(this.blocks[i].len / 2);
    if (this.blocks[i].len < 2 || at <= sp[i].from) return -1;
    this.blocks.splice(i + 1, 0, { name: 'Új szekció', tacet: false, len: sp[i].to - at + 1, bars: [] });
    this.blocks[i].len = at - sp[i].from;
    this.reslice(all);
    return i + 1;
  }
  /** húzás egy szekcióra: az lesz a forrás másolata (név, tacet, kotta), a helye és a hossza marad */
  copyOnto(from: number, to: number) {
    if (to < 0 || to === from) return;
    const src = this.blocks[from], dst = this.blocks[to];
    const tmp = { len: dst.len, bars: [...src.bars] };
    this.fitBars(tmp);   // a forrás kottája a cél hosszára igazítva
    Object.assign(dst, { name: src.name, tacet: src.tacet, bars: tmp.bars });
  }
  /** Alt + húzás két sor közé: a forrás másolata beszúrva a `at` résbe, az alatta lévő szekció ütemeiből
   *  (az utolsó sor alatt: az utolsó végéből). Semmi sem csúszik el, és csak az üres ütemek kapják meg a forrás kottáját. */
  insertCopy(src: number, at: number) {
    const all = this.flatBars(), s = this.blocks[src];
    const atEnd = at >= this.blocks.length, host = atEnd ? this.blocks.length - 1 : at, h = this.blocks[host];
    const take = Math.min(s.len, h.len);
    const copy: Block = { name: s.name, tacet: s.tacet, len: take, bars: [] };
    if (take === h.len) this.blocks.splice(host, 1, copy);   // a másolat az egész szomszédot lefedi
    else {
      h.len -= take;
      this.blocks.splice(atEnd ? host + 1 : host, 0, copy);
    }
    this.reslice(all);
    const tmp = { len: take, bars: [...s.bars] };
    this.fitBars(tmp);
    copy.bars.forEach((k, j) => {
      if (!k) copy.bars[j] = tmp.bars[j];   // a meglévő kotta nyer
    });
  }

  /* ---------------------------------------------------------------- minták */

  plen = (k: string | null) => (k && this.patterns[k]?.len) || 1;
  okRef = (r: BarRef | undefined): r is string => !!(r && this.patterns[keyOf(r)!] && partOf(r) <= this.plen(keyOf(r)));
  partBeats = (r: BarRef | undefined) => (this.okRef(r) ? this.patterns[keyOf(r)!].beats.slice((partOf(r) - 1) * 4, partOf(r) * 4) : null);
  partHands = (r: BarRef | undefined) => (this.okRef(r) && this.patterns[keyOf(r)!].hands ? this.patterns[keyOf(r)!].hands!.slice((partOf(r) - 1) * 4, partOf(r) * 4) : null);
  /** az ütem, ami ismétlésben következik */
  nextRef = (r: BarRef): BarRef => (this.okRef(r) ? refOf(keyOf(r)!, (partOf(r) % this.plen(keyOf(r))) + 1) : r);
  isFillKey = (r: BarRef | undefined) => !!(this.okRef(r) && this.patterns[keyOf(r)!].type === 'fill');
  baseOf = (r: BarRef | undefined) => {
    const k = keyOf(r);
    return (k && this.patterns[k]?.variantOf) || k;
  };
  pname = (r: BarRef | undefined) => {
    const k = keyOf(r), p = k ? this.patterns[k] : undefined;
    return !p ? '' : p.variantOf && this.patterns[p.variantOf] ? `${this.patterns[p.variantOf].name} · ${p.name}` : p.name;
  };
  variantsOf = (base: string) => Object.keys(this.patterns).filter((k) => this.patterns[k].variantOf === base);
  /** ütemek száma mintánként */
  useCount() {
    const n: Record<string, number> = {};
    this.blocks.forEach((b) => b.bars.forEach((r) => {
      if (this.okRef(r)) n[keyOf(r)!] = (n[keyOf(r)!] || 0) + 1;
    }));
    return n;
  }
  /** az alap elemek egy típusból (a szekcióban használtak elöl), mindegyik a variációival */
  cores(type: PatternType) {
    const b = this.blocks[this.shownBlock];
    const inSec = new Set(b ? b.bars.map(this.baseOf) : []);
    return Object.keys(this.patterns)
      .filter((k) => this.patterns[k].type === type && !this.patterns[k].variantOf)
      .sort((x, y) => +inSec.has(y) - +inSec.has(x))
      .map((k) => ({ key: k, inSection: inSec.has(k), variants: this.variantsOf(k) }));
  }

  /** a blokk ütemei mindig a blokk hosszával egyeznek; a végén álló fill (minden üteme) a végén marad,
   *  a groove sorban ismétlődik (egy 2 ütemes groove: 1, 2, 1, 2 …) */
  fitBars(b: { len: number; bars: BarRef[] }) {
    const bars = b.bars;
    const last = bars[bars.length - 1];
    const tail = bars.length > 1 && this.isFillKey(last) ? Math.min(partOf(last), bars.length - 1) : 0;
    while (bars.length < b.len) {
      const at = bars.length - tail, prev = bars[at - 1];
      bars.splice(at, 0, prev && !this.isFillKey(prev) ? this.nextRef(prev) : ([...bars].reverse().find((r) => r && !this.isFillKey(r)) ?? null));
    }
    while (bars.length > b.len) bars.splice(Math.max(0, bars.length - tail - 1), 1);
  }

  /** egy több ütemes minta elhelyezése a dal gi. üteme (0-tól) körül: [első ütem, ütemek] */
  placementAt(all: BarRef[], gi: number): [number, number] {
    const r = all[gi];
    if (!this.okRef(r)) return [gi, 1];
    const k = keyOf(r)!, s = gi - (partOf(r) - 1);
    let c = 0;
    while (c < this.plen(k) && s + c < all.length && keyOf(all[s + c]) === k && partOf(all[s + c]) === c + 1) c++;
    return s < 0 || c < partOf(r) ? [gi, 1] : [s, c];
  }

  /** a mutatott szekció változott (a lejátszás továbblépett, vagy a lista szerkesztődött) */
  showBlock(i: number) {
    if (i !== this.shownBlock) this.selBar = -1;
    this.shownBlock = i;
    const b = this.blocks[i];
    // GROOVE / FILLS: egy olyan elemen kezd, amit ez a szekció tényleg használ
    if (this.tab !== 'song' && b && !(this.selPat && this.patterns[this.selPat] && this.patterns[this.selPat].type === this.tab && b.bars.some((r) => this.baseOf(r) === this.baseOf(this.selPat)))) {
      const used = b.bars.map(this.baseOf).find((k) => k && this.patterns[k] && this.patterns[k].type === this.tab);
      this.selPat = used || (this.selPat && this.patterns[this.selPat]?.type === this.tab ? this.selPat : Object.keys(this.patterns).find((k) => this.patterns[k].type === this.tab && !this.patterns[k].variantOf) ?? null);
    }
  }
  setTab(tab: Tab, shownBar: number) {
    this.tab = tab;
    if (tab === 'song' && this.selBar < 0) this.selBar = Math.max(0, shownBar);
    this.showBlock(this.shownBlock);
  }
  selectPattern(k: string) {
    this.selPat = k;
    if (this.patterns[k] && this.tab !== 'song') this.tab = this.patterns[k].type;
  }

  /** a k minta (minden üteme) a mutatott szekció j. ütemétől; a szekció végén levágva. Visszaadja, hány ütem fért el. */
  placeAt(j: number, k: string | null) {
    const sp = this.spans()[this.shownBlock], all = this.flatBars(), gi = sp.from - 1 + j;
    let n = 1;
    if (!k) all[gi] = null;
    else {
      n = Math.min(this.plen(k), sp.to - (sp.from + j) + 1);
      for (let i = 0; i < n; i++) all[gi + i] = refOf(k, i + 1);
    }
    this.reslice(all);
    this.selBar = j;
    return n;
  }

  newPattern(p: Pattern) {
    const k = 'p' + Date.now().toString(36);
    this.patterns[k] = p;
    this.tab = p.type;
    this.selectPattern(k);
    return k;
  }

  /** a SONG fülön a kijelölt ütem mintája, egyébként a kijelölt elem */
  selRef = () => (this.blocks[this.shownBlock] && this.selBar >= 0 ? this.blocks[this.shownBlock].bars[this.selBar] : null);
  editKey = () => (this.tab === 'song' ? (this.okRef(this.selRef()) ? keyOf(this.selRef()) : null) : this.selPat);

  /** SONG fül: szerkesztés előtt a kijelölt hely saját variációt kap (minden ütemével),
   *  így az alap elem és a többi hely érintetlen marad */
  ownKey() {
    let k = this.editKey();
    if (!k || !this.patterns[k]) return null;
    if (this.tab !== 'song') return k;
    const all = this.flatBars(), gi = this.spans()[this.shownBlock].from - 1 + this.selBar, [s, c] = this.placementAt(all, gi);
    if (!this.patterns[k].variantOf || (this.useCount()[k] || 0) > c) {
      const base = this.baseOf(k)!, src = this.patterns[k];
      const n = Math.max(0, ...this.variantsOf(base).map((v) => +(this.patterns[v].name.match(/^v(\d+)$/) || [0, 0])[1])) + 1;
      const nk = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      this.patterns[nk] = {
        name: `v${n}`, type: this.patterns[base].type, len: this.plen(k), beats: [...src.beats],
        ...(src.hands ? { hands: [...src.hands] } : {}), variantOf: base,
      };
      for (let i = 0; i < c; i++) all[s + i] = refOf(nk, partOf(all[s + i]));
      this.reslice(all);
      k = nk;
    }
    return k;
  }

  /** kézrend tagonként ('R' | 'L' | '-'), mindig annyi tag, ahány a negyedben van */
  handsOf(p: Pattern) {
    return p.beats.map((b, bi) => {
      const n = parseBeat(b).length, h = ((p.hands ?? [])[bi] || '').trim().split(/\s+/);
      return Array.from({ length: n }, (_, i) => (h[i] === 'R' || h[i] === 'L' ? h[i] : '-'));
    });
  }
  private setHands(p: Pattern, hands: string[][]) {
    if (hands.some((hb) => hb.some((x) => x !== '-'))) p.hands = hands.map((hb) => hb.join(' '));
    else delete p.hands;
  }

  /** kézrend: kattintás R / L, ugyanaz még egyszer törli */
  toggleHand(bi: number, si: number, side: 'R' | 'L') {
    const k = this.ownKey();
    if (!k) return;
    const p = this.patterns[k], hands = this.handsOf(p);
    hands[bi][si] = hands[bi][si] === side ? '-' : side;
    this.setHands(p, hands);
  }

  /** hangok: fn(negyed → tagok) a szerkesztett mintán */
  private editCells(fn: (beat: (bi: number) => Map<string, Mark>[]) => void) {
    const k = this.ownKey();
    if (!k) return;
    const p = this.patterns[k], cache: Record<number, Map<string, Mark>[]> = {};
    const beat = (bi: number) => cache[bi] || (cache[bi] = parseBeat(p.beats[bi]));
    fn(beat);
    Object.keys(cache).forEach((bi) => {
      p.beats[+bi] = serBeat(cache[+bi]);
    });
  }
  /** kattintás egy cellára: hang → akcentus → ghost → törlés */
  cycleCell(bi: number, si: number, ins: string) {
    this.editCells((beat) => {
      const m = beat(bi)[si];
      if (!m.has(ins)) m.set(ins, '');
      else if (NEXT_MARK[m.get(ins)!] !== undefined) m.set(ins, NEXT_MARK[m.get(ins)!]!);
      else m.delete(ins);
    });
  }
  /** egy hang áthelyezése (más hangszer, tag vagy ütem), a jelölésével; cél nélkül törlés */
  moveCell(from: [number, number, string], to: [number, number, string] | null) {
    this.editCells((beat) => {
      const src = beat(from[0])[from[1]], mod = src.get(from[2]);
      src.delete(from[2]);
      if (to && mod !== undefined) beat(to[0])[to[1]].set(to[2], mod);
    });
  }
  /** új felosztás egy negyedben: minden hang a legközelebbi új tagra kerül, a kézrend vele megy */
  setSubdivision(bi: number, n: number) {
    const k = this.ownKey();
    if (!k) return;
    const p = this.patterns[k], old = parseBeat(p.beats[bi]);
    const hands = this.handsOf(p), oldHands = hands[bi];
    const slots = Array.from({ length: n }, () => new Map<string, Mark>());
    hands[bi] = Array(n).fill('-');
    const to = (i: number) => Math.min(n - 1, Math.round((i / old.length) * n));
    old.forEach((m, i) => m.forEach((mod, ins) => slots[to(i)].set(ins, mod)));
    oldHands.forEach((x, i) => {
      if (x !== '-' && hands[bi][to(i)] === '-') hands[bi][to(i)] = x;
    });
    p.beats[bi] = serBeat(slots);
    this.setHands(p, hands);
  }
  /** 1 / 2 / 4 ütem: növelve az utolsó ütem másolódik, csökkentve a végéről vág. A dal ütemei, amik a mintát
   *  használják, egész elhelyezésekre vágódnak újra (egy 1 ütemes groove 8 ütemen 4 × [1, 2] lesz). */
  setLen(k: string, L: number) {
    const p = this.patterns[k], old = this.plen(k);
    if (!p || L === old) return;
    const grow = (arr: string[]) => {
      const last = arr.slice((old - 1) * 4, old * 4);
      for (let i = old; i < L; i++) arr.push(...last);
    };
    if (L > old) {
      grow(p.beats);
      if (p.hands) grow(p.hands);
    } else {
      p.beats.length = 4 * L;
      if (p.hands) p.hands.length = 4 * L;
    }
    p.len = L;
    const all = this.flatBars();
    let run = 0;
    for (let i = 0; i < all.length; i++) {
      if (keyOf(all[i]) === k) {
        all[i] = refOf(k, (run % L) + 1);
        run++;
      } else run = 0;
    }
    this.reslice(all);
  }
  renamePattern(name: string) {
    const p = this.patterns[this.editKey() ?? ''];   // GROOVE/FILLS: a kijelölt elem · SONG: az ütem variációja
    if (p) p.name = name;
  }
  /** VISSZA AZ ALAPRA: az egész elhelyezés újra az alap elemet játssza */
  toBase() {
    const k = this.editKey();
    if (!this.blocks[this.shownBlock] || !k) return;
    const all = this.flatBars(), [s, c] = this.placementAt(all, this.spans()[this.shownBlock].from - 1 + this.selBar), base = this.baseOf(k)!;
    for (let i = 0; i < c; i++) all[s + i] = refOf(base, partOf(all[s + i]));
    this.reslice(all);
  }
  duplicate() {
    const k = this.selPat, p = k ? this.patterns[k] : null;
    if (p) this.newPattern({ name: this.pname(k) + ' másolat', type: p.type, len: this.plen(k), beats: [...p.beats], ...(p.hands ? { hands: [...p.hands] } : {}) });
  }
  /** hány ütem használja a kijelölt elemet (a variációival együtt): ennyi helyen lesz szünet, ha törlöd */
  deleteCount() {
    const k = this.selPat;
    if (!k) return { n: 0, withVariants: false };
    const gone = new Set([k, ...this.variantsOf(k)]);
    return { n: this.blocks.reduce((a, b) => a + b.bars.filter((r) => gone.has(keyOf(r)!)).length, 0), withVariants: gone.size > 1 };
  }
  deletePattern() {
    const k = this.selPat;
    if (!k) return;
    const gone = new Set([k, ...this.variantsOf(k)]);   // az alap elem viszi a variációit is
    this.blocks.forEach((b) => (b.bars = b.bars.map((r) => (gone.has(keyOf(r)!) ? null : r))));
    gone.forEach((g) => delete this.patterns[g]);
    this.selPat = null;
    this.showBlock(this.shownBlock);
  }

  /** A minta gyakorló részlete a dalban, ahogy a diák is ismétli (groove: az első futása, legfeljebb 8 ütem;
   *  fill: az előtte lévő ütemmel), a részlet ütemeinek kottájával. null, ha a minta egy ütemben sem szól. */
  practiceRange(k: string) {
    const sp = this.spans();
    const s = { ...this.S, sections: this.blocks.map((b, i) => ({ name: b.name, from: sp[i].from, to: sp[i].to, tacet: b.tacet, bars: b.bars })), patterns: this.patterns };
    const e = elements(s, this.patterns).flatMap((x) => [x, ...(x.variants ?? [])]).find((x) => x.key === k);
    if (!e) return null;
    const [from, to] = e.loop;
    const score = this.flatBars().slice(from - 1, to).map((r) => {
      const hands = this.partHands(r);
      return { beats: this.partBeats(r) ?? ['-', '-', '-', '-'], ...(hands && hands.some((h) => /[RL]/.test(h)) ? { hands } : {}) };
    });
    return { from, to, score };
  }

  /* ---------------------------------------------------------------- visszavonás és mentés */

  private snapshot() {
    return JSON.stringify({ blocks: this.blocks.map((b) => ({ name: b.name, len: b.len, tacet: b.tacet, bars: b.bars })), patterns: this.patterns });
  }
  /** minden változtatás egy lépés; a gyors egymás utániak (név gépelése, több kattintás) egy lépés */
  remember() {
    if (this.hpos < 0) return;
    const s = this.snapshot();
    if (s === this.hist[this.hpos]) return;
    this.hist = this.hist.slice(0, this.hpos + 1);
    if (Date.now() - this.histAt < 700 && this.hpos > 0) this.hist[this.hpos] = s;
    else {
      this.hist.push(s);
      this.hpos++;
    }
    this.histAt = Date.now();
  }
  canUndo = () => this.hpos > 0;
  canRedo = () => this.hpos < this.hist.length - 1;
  restoreStep(i: number) {
    this.hpos = i;
    const d = JSON.parse(this.hist[i]);
    this.blocks = d.blocks;
    this.patterns = d.patterns;
    if (this.selPat && !this.patterns[this.selPat]) this.selPat = null;
    this.histAt = 0;
  }
  undo() {
    if (this.hpos > 0) this.restoreStep(this.hpos - 1);
  }
  redo() {
    if (this.hpos < this.hist.length - 1) this.restoreStep(this.hpos + 1);
  }
  reset() {
    if (this.hpos > 0) this.restoreStep(0);
  }

  /** a mentendő szerkezet: a már sehol sem használt variáció kimarad (pl. VISSZA AZ ALAPRA után) */
  toStructure() {
    const uses = this.useCount();
    for (const k of Object.keys(this.patterns)) if (this.patterns[k].variantOf && !uses[k]) delete this.patterns[k];
    const sp = this.spans();
    const sections = this.blocks.map((b, i) => ({ name: b.name, from: sp[i].from, to: sp[i].to, tacet: b.tacet, bars: b.bars }));
    return cleanStructure({ ...this.S, sections, patterns: this.patterns });
  }
}
