import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { loadPracticeMix, preloadSamples, SCORE_DIV, scoreBars, setPracticeMix, type PracticeMix } from '../audio/engine';
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
}

/** Kotta lejátszógombbal és tempóval: visszahallgatható, a lejátszófej követi a kottát. */
export function ScorePlayer({ id, bars, bpm, onBpm, min, max }: PlayerProps) {
  const { t, pick } = useI18n();
  const { playingId, step, toggle, stop } = usePlayback();
  const playId = `score:${id}`;
  const playing = playingId === playId;
  useEffect(() => {
    void preloadSamples();
    return stop;
  }, [stop]);
  // A kotta vagy a tempó változására a futó lejátszás leáll: a következő indítás már az újat játssza.
  useEffect(() => {
    if (playing) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, bpm]);

  return (
    <section className="score-card">
      <Score bars={bars} perRow={window.innerWidth < 600 ? 1 : 2} step={playing ? step : 0} />
      <div className="transport">
        <button
          type="button"
          className="play-btn"
          aria-label={playing ? t.stop : t.play}
          onClick={() => toggle(playId, scoreBars(bars), { bpm, loop: true, div: SCORE_DIV, track: true })}
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
      <PracticeMixer />
    </section>
  );
}

/* a gyakorlás keverése az egész appban közös: egy helyen állítva mindegyik lejátszón ugyanaz látszik */
let mixNow = loadPracticeMix();
const mixListeners = new Set<() => void>();
const subscribeMix = (f: () => void) => {
  mixListeners.add(f);
  return () => mixListeners.delete(f);
};
function changeMix(next: PracticeMix) {
  mixNow = next;
  setPracticeMix(next);
  mixListeners.forEach((f) => f());
}

/** Dob és metronóm hangereje a gyakorlatoknál (mint a dal keverőjén). A dob 0-n: csak a metronóm szól. */
export function PracticeMixer({ className = '' }: { className?: string }) {
  const { pick } = useI18n();
  const mix = useSyncExternalStore(subscribeMix, () => mixNow);
  return (
    <div className={`practice-mix ${className}`}>
      <label className="slider tempo">
        <span>
          {pick('Dob', 'Drums')} <b>{mix.drums}</b>
        </span>
        <input type="range" min={0} max={100} value={mix.drums} onChange={(e) => changeMix({ ...mix, drums: +e.target.value })} />
      </label>
      <label className="slider tempo">
        <span>
          {pick('Metronóm', 'Metronome')} <b>{mix.metro}</b>
        </span>
        <input type="range" min={0} max={100} value={mix.metro} onChange={(e) => changeMix({ ...mix, metro: +e.target.value })} />
      </label>
    </div>
  );
}
