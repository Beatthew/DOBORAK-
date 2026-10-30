import { useEffect, useMemo, useRef } from 'react';
import { preloadSamples, SCORE_DIV, scoreBars } from '../audio/engine';
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
}

/** Kotta lejátszógombbal és tempóval: visszahallgatható, a lejátszófej követi a kottát. */
export function ScorePlayer({ id, bars, bpm, onBpm }: PlayerProps) {
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
          <input type="range" min={40} max={200} value={bpm} onChange={(e) => onBpm(+e.target.value)} />
        </label>
      </div>
    </section>
  );
}
