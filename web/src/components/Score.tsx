import { useEffect, useMemo, useRef, useState } from 'react';
import { PRACTICE_MIX0, preloadSamples, SCORE_DIV, scoreBars, setPracticeMix, type PracticeMix } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { useI18n } from '../i18n';
import { rowSVG, setPlayhead } from '../songs/notation';
import type { Beats } from '../songs/types';
import { PlayIcon, StopIcon } from './Icons';

const STEPS_PER_BAR = SCORE_DIV * 4;
const BAR_WIDTH = 440;

interface ScoreProps {
  bars: Beats[];
  perRow?: number;
  /** Hol tart a lejátszás (lépés, 1-től); 0 = áll. */
  step?: number;
}

/** Hagyományos dobkotta, a Song Practice jelölésével; a színek a környező tónushoz igazodnak. */
export function Score({ bars, perRow = 2, step = 0 }: ScoreProps) {
  const box = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    const rows: string[] = [];
    for (let i = 0; i < bars.length; i += perRow) {
      const part = bars.slice(i, i + perRow);
      rows.push(rowSVG(part, part.map((_, k) => (bars.length > 1 ? `${i + k + 1}.` : '')), BAR_WIDTH * part.length));
    }
    return rows.join('');
  }, [bars, perRow]);

  useEffect(() => {
    const pos = step > 0 ? (step - 1) / STEPS_PER_BAR : -1;
    const bar = Math.floor(pos);
    box.current?.querySelectorAll('svg').forEach((svg, row) => {
      setPlayhead(svg, step > 0 ? bar - row * perRow : -1, pos - bar);
    });
  }, [step, html, perRow]);

  return <div className="score" ref={box} dangerouslySetInnerHTML={{ __html: html }} />;
}

interface PlayerProps {
  id: string;
  bars: Beats[];
  bpm: number;
  onBpm: (bpm: number) => void;
  /** a tempócsúszka tartománya (alapból 40–200) */
  min?: number | null;
  max?: number | null;
  /** a kotta vagy a tempó változásakor a futó lejátszás az újjal folytatódik (különben leáll) */
  restartOnChange?: boolean;
  /** több ütemnél mindig csak az épp szóló ütem látszik (pl. a ritmusskála loopja) */
  follow?: boolean;
  /** felirat a kotta fölött; follow módban az épp látszó ütem sorszámával (0-tól) */
  caption?: (bar: number) => string;
}

/** Kotta lejátszógombbal és tempóval: visszahallgatható, a lejátszófej követi a kottát. */
export function ScorePlayer({ id, bars, bpm, onBpm, min, max, restartOnChange, follow, caption }: PlayerProps) {
  const { t, pick } = useI18n();
  const { playingId, step, toggle, stop } = usePlayback();
  const playId = `score:${id}`;
  const playing = playingId === playId;
  const [mix, setMix] = usePracticeMix(playing);
  const restart = useRef(false);
  const play = () => {
    setPracticeMix(mix);
    toggle(playId, scoreBars(bars), { bpm, loop: true, div: SCORE_DIV, track: true });
  };
  useEffect(() => {
    void preloadSamples();
    return stop;
  }, [stop]);
  // A kotta vagy a tempó változására a futó lejátszás leáll: a következő indítás már az újat játssza
  // (restartOnChange esetén magától újraindul, amint a leállás lefutott).
  useEffect(() => {
    if (!playing) return;
    restart.current = !!restartOnChange;
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, bpm]);
  useEffect(() => {
    if (playingId !== null || !restart.current) return;
    restart.current = false;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);

  const cur = follow && playing && step > 0 ? Math.floor((step - 1) / STEPS_PER_BAR) % bars.length : 0;
  const shown = useMemo(() => (follow ? [bars[cur]] : bars), [follow, bars, cur]);
  const shownStep = !playing ? 0 : follow && step > 0 ? step - cur * STEPS_PER_BAR : step;

  return (
    <section className="score-card">
      {caption && <p className="score-caption">{caption(cur)}</p>}
      <Score bars={shown} perRow={window.innerWidth < 600 ? 1 : 2} step={shownStep} />
      <div className="transport">
        <button
          type="button"
          className="play-btn"
          aria-label={playing ? t.stop : t.play}
          onClick={play}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>
        <label className="slider tempo">
          <span>
            {pick('Tempó', 'Tempo')} <b>{bpm} BPM</b>
          </span>
          <input type="range" min={min ?? 40} max={max ?? 200} value={bpm} onChange={(e) => onBpm(+e.target.value)} />
        </label>
      </div>
      <PracticeMixer mix={mix} onChange={setMix} />
    </section>
  );
}

/** Dob és metronóm hangereje egy gyakorlatnál (mint a dal keverőjén). A dob 0-n: csak a metronóm szól.
 *  Minden gyakorlatnak saját keverése van, nem hat a többire. */
export function PracticeMixer({ mix, onChange, className = '' }: { mix: PracticeMix; onChange: (m: PracticeMix) => void; className?: string }) {
  const { pick } = useI18n();
  return (
    <div className={`practice-mix ${className}`}>
      <label className="slider tempo">
        <span>
          {pick('Dob', 'Drums')} <b>{mix.drums}</b>
        </span>
        <input type="range" min={0} max={100} value={mix.drums} onChange={(e) => onChange({ ...mix, drums: +e.target.value })} />
      </label>
      <label className="slider tempo">
        <span>
          {pick('Metronóm', 'Metronome')} <b>{mix.metro}</b>
        </span>
        <input type="range" min={0} max={100} value={mix.metro} onChange={(e) => onChange({ ...mix, metro: +e.target.value })} />
      </label>
    </div>
  );
}

/** egy gyakorlat saját keverése: induláskor és állításkor (ha épp ez szól) ez kerül a lejátszóra */
export function usePracticeMix(playing: boolean) {
  const [mix, setMix] = useState<PracticeMix>(PRACTICE_MIX0);
  useEffect(() => {
    if (playing) setPracticeMix(mix);
  }, [playing, mix]);
  return [mix, setMix] as const;
}
