import type { Beats, SongData } from './types';

/* Dobkotta SVG-ben, a Song Practice jelölésével (a BEATHUB színeivel; a színek CSS-változók, így sötét és világos alapon is működik):
   egy ütem = 4 negyed; egy negyeden belül a szóközzel elválasztott tagok száma adja a felosztást
   (1 = negyed, 2 = 8-ad, 3 = triola, 4 = 16-od, 6 = szextola). '-' = szünet, '+' = egyszerre ütött hangszerek.
   h zárt hihat, o nyitott hihat, r ride, c crash, t kistam, u középtam, s pergő, f álló tam, k lábdob;
   '(s)' ghost note, 's>' hangsúly. A beats tömb opcionális .hands mezője a kézrend (R / L). */

const TOP = 46, GAP = 11, HS = GAP / 2, STEM_TOP = 8;
export const PADL = 24, PADR = 14;
const POS: Record<string, number> = { c: -3, h: -1, o: -1, r: 0, t: 1, u: 2, s: 3, f: 5, k: 7 };   // félközök a felső vonaltól
const yPos = (p: number) => TOP + p * HS;

const C = {
  ink: 'var(--n-ink, #fcf7ff)',
  staff: 'var(--n-staff, rgba(252,247,255,.32))',
  barline: 'var(--n-bar, rgba(252,247,255,.6))',
  num: 'var(--n-num, rgba(252,247,255,.5))',
  fill: 'var(--n-fill, #f0dcca)',
  fillBg: 'var(--n-fillbg, rgba(240,220,202,.12))',
  ride: 'var(--n-ride, #9fd3c7)',
  hl: 'var(--n-hl, rgba(112,248,186,.14))',
  head: 'var(--n-head, #70f8ba)',
};

export interface Marks {
  fillBars: Set<number>;
  rideBars: Set<number>;
}

export const marksOf = (song: SongData): Marks => ({
  fillBars: new Set(song.events.filter((e) => e.kind === 'FILL').flatMap((e) => Array.from({ length: e.to - e.from + 1 }, (_, i) => e.from + i))),
  rideBars: song.rideBars,
});

function head(inst: string, x: number) {
  const y = yPos(POS[inst]);
  let g = '';
  if (inst === 'c') g += `<line x1="${x - 10}" x2="${x + 10}" y1="${yPos(-2)}" y2="${yPos(-2)}" stroke="${C.ink}" stroke-width="1.2"/>`;
  if ('hocr'.includes(inst)) {
    g += `<path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}" stroke="${C.ink}" stroke-width="2"/>`;
    if (inst === 'c') g += `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="${C.ink}" stroke-width="1.4"/>`;
    if (inst === 'o') g += `<circle cx="${x + 6}" cy="${STEM_TOP - 10}" r="4" fill="none" stroke="${C.fill}" stroke-width="1.8"/>`;
  } else {
    g += `<ellipse cx="${x}" cy="${y}" rx="6.4" ry="4.8" transform="rotate(-20 ${x} ${y})" fill="${C.ink}"/>`;
  }
  return g;
}
const quarterRest = (x: number, y: number) =>
  `<path d="M${x - 2} ${y - 14}l7 9-6 6 7 9c-6-3-10 0-6 6" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;

/** egy ütem: num = ütemszám (vagy felirat), a jelölések (FILL / RIDE) a dal ütemszáma alapján */
export function drawBar(beats: Beats | null | undefined, x0: number, w: number, num: number | string, marks?: Marks) {
  let g = '';
  const isFill = typeof num === 'number' && !!marks?.fillBars.has(num);
  const hands = beats?.hands, sticking = !!hands && hands.some((h) => /[RL]/.test(h));
  const ly = yPos(8) + (sticking ? 27 : 22);
  if (isFill) g += `<rect x="${x0 + 2}" y="${STEM_TOP - 6}" width="${w - 4}" height="${yPos(8) + 12 - STEM_TOP}" rx="6" fill="${C.fillBg}"/>`;
  g += `<text x="${x0 + 6}" y="${ly}" font-size="13" font-weight="700" fill="${C.num}">${num}</text>`;
  if (isFill) g += `<text x="${x0 + 34}" y="${ly}" font-size="12" font-weight="800" letter-spacing="1.5" fill="${C.fill}">FILL</text>`;
  if (typeof num === 'number' && marks?.rideBars.has(num))
    g += `<text x="${x0 + 34}" y="${ly}" font-size="12" font-weight="800" letter-spacing="1.5" fill="${C.ride}">RIDE</text>`;
  g += `<line x1="${x0 + w}" x2="${x0 + w}" y1="${TOP}" y2="${yPos(8)}" stroke="${C.barline}" stroke-width="1.6"/>`;
  if (!beats) return g;
  const inner = w - PADL - PADR, bw = inner / beats.length;
  if (beats.every((b) => /^[-\s]+$/.test(b))) return g + `<rect x="${x0 + w / 2 - 9}" y="${yPos(2)}" width="18" height="6" fill="${C.ink}"/>`;
  beats.forEach((beat, bi) => {
    const slots = beat.trim().split(/\s+/), m = slots.length;
    const notes = slots.map((sl, i) => (sl === '-' ? null : { i, inst: sl.split('+'), x: 0, sx: 0, lvl: 0 })).filter((n): n is NonNullable<typeof n> => !!n);
    const bx = x0 + PADL + bi * bw;
    if (sticking)
      (hands![bi] || '').trim().split(/\s+/).forEach((h, i) => {
        if (h === 'R' || h === 'L')
          g += `<text x="${bx + 8 + (i / m) * bw}" y="${yPos(8) + 15}" text-anchor="middle" font-size="12" font-weight="800" fill="${h === 'R' ? C.ink : C.head}">${h}</text>`;
      });
    if (!notes.length) {
      g += quarterRest(bx + 8, yPos(4));
      return;
    }
    notes.forEach((n, j) => {
      n.x = bx + 8 + (n.i / m) * bw;
      const d = ((notes[j + 1] ? notes[j + 1].i : m) - n.i) / m;
      n.lvl = m === 1 || d >= 1 ? 0 : m === 3 ? 1 : m === 6 ? 2 : d >= 0.5 ? 1 : 2;
      const toks = n.inst.map((tok) => [tok.replace(/[()>]/g, ''), /^\(.*\)$/.test(tok) ? 'g' : tok.endsWith('>') ? '>' : ''] as const);
      toks.forEach(([ins, mod]) => {
        g += head(ins, n.x);
        if (mod === 'g')
          g += `<text x="${n.x - 10}" y="${yPos(POS[ins]) + 4.5}" text-anchor="middle" font-size="14" fill="${C.ink}">(</text><text x="${n.x + 10}" y="${yPos(POS[ins]) + 4.5}" text-anchor="middle" font-size="14" fill="${C.ink}">)</text>`;
      });
      const low = Math.max(...toks.map(([ins]) => yPos(POS[ins])));
      n.sx = n.x + 6;
      g += `<line x1="${n.sx}" x2="${n.sx}" y1="${low - 2}" y2="${STEM_TOP}" stroke="${C.ink}" stroke-width="1.6"/>`;
      if (toks.some(([, mod]) => mod === '>'))
        g += `<path d="M${n.sx - 5} ${STEM_TOP - 13}L${n.sx + 5} ${STEM_TOP - 10}L${n.sx - 5} ${STEM_TOP - 7}" fill="none" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    });
    if (notes.length === 1) {
      const n = notes[0];
      for (let l = 0; l < n.lvl; l++) g += `<path d="M${n.sx} ${STEM_TOP + l * 8}q4 8 12 12q-2 4-2 10" fill="none" stroke="${C.ink}" stroke-width="2.2"/>`;
    } else {
      const a = notes[0], z = notes[notes.length - 1];
      g += `<rect x="${a.sx - 0.8}" y="${STEM_TOP}" width="${z.sx - a.sx + 1.6}" height="5" fill="${C.ink}"/>`;
      notes.forEach((n, j) => {
        if (n.lvl < 2) return;
        const nx = notes[j + 1], pv = notes[j - 1];
        if (nx && nx.lvl >= 2) g += `<rect x="${n.sx - 0.8}" y="${STEM_TOP + 8}" width="${nx.sx - n.sx + 1.6}" height="5" fill="${C.ink}"/>`;
        else if (!(pv && pv.lvl >= 2)) g += `<rect x="${nx ? n.sx : n.sx - 10}" y="${STEM_TOP + 8}" width="10" height="5" fill="${C.ink}"/>`;
      });
      if (m === 3 || m === 6)
        g += `<text x="${(a.sx + z.sx) / 2}" y="${STEM_TOP - 6}" text-anchor="middle" font-size="13" font-style="italic" font-weight="700" fill="${C.barline}">${m}</text>`;
    }
  });
  return g;
}

const staff = (w: number) => {
  let g = '';
  for (let l = 0; l < 5; l++) g += `<line x1="0" x2="${w}" y1="${yPos(l * 2)}" y2="${yPos(l * 2)}" stroke="${C.staff}" stroke-width="1"/>`;
  return g + `<line x1="0" x2="0" y1="${TOP}" y2="${yPos(8)}" stroke="${C.barline}" stroke-width="1.6"/>`;
};
const hlRect = (x: number, w: number, i: number) =>
  `<rect class="hl" data-i="${i}" x="${x}" y="${STEM_TOP - 6}" width="${w}" height="${yPos(8) + 12 - STEM_TOP}" rx="6" fill="${C.hl}" opacity="0"/>`;
const phLine = (x0: number, i: number) =>
  `<line class="ph" data-i="${i}" data-x0="${x0}" x1="0" x2="0" y1="${STEM_TOP - 4}" y2="${yPos(8) + 8}" stroke="${C.head}" stroke-width="3.5" stroke-linecap="round" opacity="0"/>`;

export const VIEWBOX_H = 130;
/** egy kottasor: tetszőleges ütemek egymás mellett; vw = a viewBox szélessége */
export function rowSVG(bars: (Beats | null | undefined)[], nums: (number | string)[], vw: number, marks?: Marks) {
  const w = vw / bars.length;
  let g = bars.map((_, i) => hlRect(i * w, w, i)).join('') + staff(vw);
  bars.forEach((b, i) => (g += drawBar(b, i * w, w, nums[i], marks)));
  g += bars.map((_, i) => phLine(i * w, i)).join('');
  return `<svg viewBox="0 -12 ${vw} ${VIEWBOX_H}" data-w="${w}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}

/** egy ütés-gyakorlat ütemének egy sora: fölül az ütéstípus betűi, alul a két kézrend, az ismétlőjelek a sor szélén */
export function strokeBarSVG(beats: Beats, strokes: string, hands: [string, string], w: number, repeat: { open: boolean; close: boolean }) {
  const inner = w - PADL - PADR, midY = yPos(4);
  const slotX = (i: number) => PADL + 8 + (i / strokes.length) * inner;
  let g = hlRect(0, w, 0) + staff(w) + drawBar(beats, 0, w, '');
  [...strokes].forEach((s, i) => (g += `<text class="stroke-letter" data-i="${i}" x="${slotX(i) + 6}" y="-3" text-anchor="middle" font-size="18" font-weight="800" fill="${C.ink}">${s}</text>`));
  hands.forEach((row, r) =>
    [...row].forEach((h, i) => (g += `<text x="${slotX(i) + 6}" y="${yPos(8) + 20 + r * 19}" text-anchor="middle" font-size="16" font-weight="700" fill="${C.ink}">${h}</text>`)),
  );
  const dots = (x: number) => [-1, 1].map((d) => `<circle cx="${x}" cy="${midY + d * HS}" r="2" fill="${C.ink}"/>`).join('');
  if (repeat.open) g += `<rect x="0" y="${TOP}" width="4" height="${yPos(8) - TOP}" fill="${C.ink}"/>${dots(11)}`;
  if (repeat.close) g += `<rect x="${w - 4}" y="${TOP}" width="4" height="${yPos(8) - TOP}" fill="${C.ink}"/>${dots(w - 11)}`;
  g += phLine(0, 0);
  return `<svg viewBox="0 -20 ${w} 158" data-w="${w}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}

/** kiemelés + lejátszófej egy kottasoron: i = az aktív ütem indexe a sorban (vagy -1), frac = hol tart benne */
export function setPlayhead(svg: SVGSVGElement | null, i: number, frac: number, dimOthers = false) {
  if (!svg) return;
  const w = +(svg.dataset.w || 0);
  svg.querySelectorAll<SVGRectElement>('.hl').forEach((r) => r.setAttribute('opacity', +r.dataset.i! === i ? '1' : dimOthers ? '0.35' : '0'));
  svg.querySelectorAll<SVGLineElement>('.ph').forEach((ph) => {
    const on = +ph.dataset.i! === i;
    ph.setAttribute('opacity', on ? '1' : '0');
    if (on) {
      const x = String(+ph.dataset.x0! + PADL + 2 + frac * (w - PADL - PADR));
      ph.setAttribute('x1', x);
      ph.setAttribute('x2', x);
    }
  });
}

/** a viewBox szélessége a doboz arányához: kevés hely → a kotta magasságban nő (ütemenként 300–650) */
export function fitWidth(el: Element | null, nBars: number) {
  const r = el?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return 500 * nBars;
  return Math.max(300 * nBars, Math.min(650 * nBars, (r.width / r.height) * VIEWBOX_H));
}
