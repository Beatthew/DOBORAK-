import type { SongData } from './types';

/* A Song Practice motorja, felület nélkül.
   - Időzítés: a dal tempótérképe (ütem ↔ másodperc), mert a felvételek tempója nem állandó.
   - Lejátszás: a band és a drums sáv mintapontosan együtt; loop; lassítás hangmagasság-változás nélkül
     (Signalsmith Stretch: mind a négy csatorna egy node-ban, így lassítva is együtt maradnak).
   - Metronóm: a dal saját ütemrácsán, negyedenként; lassításnál és loopnál is a hallott zenéhez igazodik. */

export const BEATS = 4;

export class Timing {
  readonly bar: number;
  constructor(readonly song: SongData) {
    this.bar = (BEATS * 60) / song.bpm;
  }
  /** ütempozíció (lehet tört) → mp */
  barTime(n: number) {
    const k = this.song.tempoMap;
    if (n <= k[0][0]) return k[0][1] + (n - k[0][0]) * this.bar;
    for (let i = 1; i < k.length; i++)
      if (n <= k[i][0]) {
        const [b0, t0] = k[i - 1], [b1, t1] = k[i];
        return t0 + ((n - b0) / (b1 - b0)) * (t1 - t0);
      }
    const [bl, tl] = k[k.length - 1];
    return tl + (n - bl) * this.bar;
  }
  /** mp → ütempozíció (1.0 = 1. ütem eleje) */
  barPos(t: number) {
    const k = this.song.tempoMap;
    if (t <= k[0][1]) return k[0][0] + (t - k[0][1]) / this.bar;
    for (let i = 1; i < k.length; i++)
      if (t <= k[i][1]) {
        const [b0, t0] = k[i - 1], [b1, t1] = k[i];
        return b0 + ((t - t0) / (t1 - t0)) * (b1 - b0);
      }
    const [bl, tl] = k[k.length - 1];
    return bl + (t - tl) / this.bar;
  }
  barStart = (n: number) => (n <= 1 ? 0 : this.barTime(n));
  /** az a..b ütemek mint lejátszási tartomány (mp) */
  range = (a: number, b: number): [number, number] => [this.barStart(a), this.barTime(b + 1)];
  barAt = (t: number) => Math.max(1, Math.floor(this.barPos(t)));
  lastBar = () => this.song.score.length - 1;
}

const STRETCH_URL = 'https://cdn.jsdelivr.net/npm/signalsmith-stretch@1.3.2/SignalsmithStretch.mjs';
type StretchNode = AudioWorkletNode & {
  schedule(o: Record<string, unknown>): void;
  addBuffers(b: Float32Array[]): Promise<number>;
  dropBuffers(): void;
};
let stretchLib: Promise<(c: AudioContext, o?: AudioWorkletNodeOptions) => Promise<StretchNode>> | null = null;
const loadStretch = () => (stretchLib ??= import(/* @vite-ignore */ STRETCH_URL).then((m) => m.default));

type Ch = 'Band' | 'Drums';

export class SongEngine {
  readonly ctx = new AudioContext();
  readonly timing: Timing;
  duration = 0;
  playing = false;
  loop: [number, number] | null = null;
  rate = 1;
  private buf!: Record<Ch, AudioBuffer>;
  private g!: Record<Ch, GainNode>;
  private pre!: Record<Ch, GainNode>;
  private metro!: GainNode;
  private src: AudioBufferSourceNode[] = [];
  private pos = 0;
  private t0: number | null = null;
  private run = 0;
  private st: StretchNode | null = null;
  private stKey: string | null = null;
  private region: [number, number] = [0, 0];
  private metroTimer = 0;
  private sent = new Map<number, number>();
  private clicks: { o: OscillatorNode; at: number }[] = [];

  private constructor(readonly song: SongData) {
    this.timing = new Timing(song);
  }

  static async load(song: SongData) {
    const e = new SongEngine(song);
    const c = e.ctx;
    const get = (f: string) =>
      // teljes link (a tárhely aláírt linkje), vagy a public/songs mappán belüli út (a kivágott részletek)
      fetch(/^https?:/.test(f) ? f : new URL(`songs/${f}`, document.baseURI)).then((r) => {
        if (!r.ok) throw new Error(`${f} (${r.status})`);
        return r.arrayBuffer();
      }).then((b) => c.decodeAudioData(b));
    const [d, b] = await Promise.all([get(song.files.Drums), get(song.files.Band)]);
    e.buf = { Drums: d, Band: b };
    const mk = () => c.createGain();
    e.g = { Drums: mk(), Band: mk() };
    e.pre = { Drums: mk(), Band: mk() };
    (['Band', 'Drums'] as Ch[]).forEach((ch) => {
      e.g[ch].connect(c.destination);
      e.pre[ch].connect(e.g[ch]);
    });
    e.metro = mk();
    e.metro.gain.value = 0;
    e.metro.connect(c.destination);
    e.duration = Math.min(d.duration, b.duration);
    e.metroTimer = window.setInterval(() => e.metroTick(), 25);
    return e;
  }

  close() {
    this.pause();
    clearInterval(this.metroTimer);
    void this.ctx.close();
  }

  /** a most hallható pozíció a dalban (mp) */
  time() {
    if (!this.playing || this.t0 == null) return this.pos;
    let t = this.pos + Math.max(0, this.ctx.currentTime - this.t0) * this.rate;
    if (this.loop && this.pos < this.loop[1] && t >= this.loop[1]) {
      const [a, b] = this.loop;
      t = a + ((t - a) % (b - a));
    }
    return Math.min(Math.max(t, 0), this.duration);
  }

  play() {
    void this.ctx.resume();
    this.playing = true;
    this.t0 = null;
    const run = ++this.run;
    if (this.rate === 1) return this.playDirect();
    this.prepStretch()
      .then(() => {
        if (run !== this.run || !this.playing || !this.st) return;
        const when = this.ctx.currentTime + 0.12, [a, b] = this.region;
        this.st.schedule({ active: true, input: this.pos - a, rate: this.rate, loopStart: 0, loopEnd: this.loop ? b - a : 0, output: when });
        this.t0 = when;
      })
      .catch((err) => {
        console.warn('stretch', err);
        if (run === this.run && this.playing) {
          this.rate = 1;
          this.playDirect();
        }
      });
  }

  private playDirect() {
    const when = this.ctx.currentTime + 0.04;
    this.src = (['Band', 'Drums'] as Ch[]).map((ch) => {
      const s = this.ctx.createBufferSource();
      s.buffer = this.buf[ch];
      s.connect(this.pre[ch]);
      if (this.loop) {
        s.loop = true;
        s.loopStart = this.loop[0];
        s.loopEnd = this.loop[1];
      }
      s.start(when, this.pos);
      return s;
    });
    this.t0 = when;
  }

  /** a stretch node és a lejátszandó részlet (a loop, vagy az egész dal) előkészítése */
  private async prepStretch() {
    const c = this.ctx;
    if (!this.st) {
      const Stretch = await loadStretch();
      const st = await Stretch(c, { outputChannelCount: [4] });
      const split = c.createChannelSplitter(4);
      st.connect(split);
      (['Band', 'Drums'] as Ch[]).forEach((ch, k) => {
        const m = c.createChannelMerger(2);
        split.connect(m, 2 * k, 0);
        split.connect(m, 2 * k + 1, 1);
        m.connect(this.pre[ch]);
      });
      this.st = st;
    }
    const region: [number, number] = this.loop ? [...this.loop] : [0, this.duration];
    const key = region.join('|');
    if (this.stKey === key) return;
    this.stKey = null;
    const sr = c.sampleRate, n = Math.min(this.buf.Band.length, this.buf.Drums.length);
    const i0 = Math.max(0, Math.floor(region[0] * sr)), i1 = Math.min(n, Math.ceil(region[1] * sr));
    const two = (B: AudioBuffer) => {
      const L = B.getChannelData(0), R = B.numberOfChannels > 1 ? B.getChannelData(1) : L;
      return [L.slice(i0, i1), R.slice(i0, i1)];
    };
    const st = this.st as StretchNode;   // a fenti ág már létrehozta
    st.dropBuffers();
    await st.addBuffers([...two(this.buf.Band), ...two(this.buf.Drums)]);
    this.region = [i0 / sr, i1 / sr];
    this.stKey = key;
  }

  pause() {
    if (!this.playing) return;
    this.pos = this.time();
    this.run++;
    this.src.forEach((s) => s.stop());
    this.src = [];
    this.st?.schedule({ active: false });
    this.playing = false;
    this.t0 = null;
  }

  seek(t: number) {
    const p = this.playing;
    this.pause();
    this.pos = Math.max(0, Math.min(t, this.duration - 0.05));
    if (p) this.play();
  }

  setLoop(r: [number, number] | null) {
    this.loop = r;
    if (this.playing) this.seek(this.time());
    else if (this.rate !== 1) this.prepStretch().catch(() => {});
  }

  setRate(r: number) {
    if (r === this.rate) return;
    const p = this.playing;
    this.pause();
    this.rate = r;
    if (p) this.play();
    else if (r !== 1) this.prepStretch().catch(() => {});   // előre betölt, hogy az indítás azonnali legyen
  }

  /** 0–1, négyzetes görbével (természetesebb halkítás) */
  setVol(ch: Ch | 'Metro', v: number) {
    const g = ch === 'Metro' ? this.metro : this.g[ch];
    g.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.015);
  }

  /** a dal végén megáll (loop nélkül); true, ha most állt meg */
  tick() {
    if (this.playing && !this.loop && this.time() >= this.duration - 0.02) {
      this.pause();
      this.pos = 0;
      return true;
    }
    return false;
  }

  private metroTick() {
    const now = this.ctx.currentTime;
    if (!this.playing || this.t0 == null || this.metro.gain.value < 0.0005) {
      this.clicks.forEach(({ o, at }) => {
        if (at > now) try { o.stop(); } catch { /* már leállt */ }
      });
      this.clicks = [];
      this.sent.clear();
      return;
    }
    const tm = this.timing, t = this.time(), r = this.rate, lp = this.loop, end = t + 0.2 * r;
    const spans: [number, number, number][] = [];
    if (lp && t < lp[1] && end > lp[1]) spans.push([t, lp[1], now], [lp[0], lp[0] + end - lp[1], now + (lp[1] - t) / r]);
    else spans.push([t, end, now]);
    for (const [a, b, c0] of spans) {
      for (let q = Math.ceil(tm.barPos(a) * BEATS - 1e-6); q <= tm.barPos(b) * BEATS; q++) {
        const st = tm.barTime(q / BEATS);
        if (st < a || st >= b) continue;
        const at = c0 + (st - a) / r, key = Math.round(at * 100);
        if (at < now || this.sent.has(key)) continue;
        this.sent.set(key, at);
        this.click(at, ((q % BEATS) + BEATS) % BEATS === 0);
      }
    }
    for (const [k, at] of this.sent) if (at < now - 1) this.sent.delete(k);
    this.clicks = this.clicks.filter((x) => x.at > now - 0.2);
  }

  private click(at: number, accent: boolean) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(accent ? 0.9 : 0.55, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    o.connect(g).connect(this.metro);
    o.start(at);
    o.stop(at + 0.06);
    this.clicks.push({ o, at });
  }
}
