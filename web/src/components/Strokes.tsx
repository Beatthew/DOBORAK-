import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { preloadSamples, SCORE_DIV, scoreBars } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { STROKE_EXERCISES, STROKE_TYPES, strokeBeats, type StrokeExercise, type StrokeType } from '../data/strokes';
import { useI18n } from '../i18n';
import { setPlayhead, strokeBarSVG } from '../songs/notation';
import { PlayIcon, StopIcon } from './Icons';

const ANGLE = { high: 26, low: 6 };
const V_Y = { high: 4, low: 24 };

/** Egy ütéstípus: oldalnézetben a verő a dobbőrön, alatta a kottalap V jele, rajta a verővel együtt futó ponttal. */
function StrokeTile({ stroke: s, tone }: { stroke: StrokeType; tone: number }) {
  const { pick } = useI18n();
  const style = {
    '--from': `${ANGLE[s.from]}deg`,
    '--to': `${ANGLE[s.to]}deg`,
    '--v-from': `${V_Y[s.from]}px`,
    '--v-to': `${V_Y[s.to]}px`,
  } as CSSProperties;
  return (
    <article className={`stroke-tile tone-${tone}`} style={style}>
      <svg className="stroke-anim" viewBox="0 0 160 100" aria-hidden="true">
        <rect x="8" y="84" width="72" height="9" rx="3" fill="currentColor" />
        <ellipse className="stroke-hit" cx="40" cy="84" rx="26" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <g className="stroke-stick">
          <line x1="42" y1="79" x2="152" y2="66" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <ellipse cx="39" cy="79.5" rx="6" ry="3.6" fill="currentColor" />
        </g>
      </svg>
      <div className="stroke-tile-text">
        <svg className="stroke-v" viewBox="0 0 44 44" aria-hidden="true">
          <path d={`M8 ${V_Y[s.from]}L22 38L36 ${V_Y[s.to]}`} fill="none" stroke="currentColor" strokeWidth="2" />
          <circle className="stroke-dot" r="3.6" fill="currentColor" />
        </svg>
        <h3>
          {s.name} <span>({s.letter})</span>
        </h3>
      </div>
      <p>{pick(s.descHu, s.descEn)}</p>
    </article>
  );
}

function ExerciseTile({ ex, bpm }: { ex: StrokeExercise; bpm: number }) {
  const { t } = useI18n();
  const { playingId, step, toggle, stop } = usePlayback();
  const box = useRef<HTMLDivElement>(null);
  const playId = `stroke:${ex.n}`;
  const playing = playingId === playId;
  const html = useMemo(
    () =>
      ex.bars
        .map((bar, i) =>
          strokeBarSVG(strokeBeats(bar, ex.meter, false), bar, ex.hands, ex.meter === 2 ? 230 : 400, {
            open: i === 0,
            close: i === ex.bars.length - 1,
          }),
        )
        .join(''),
    [ex],
  );
  const sound = useMemo(() => scoreBars(ex.bars.map((bar) => strokeBeats(bar, ex.meter, true))), [ex]);

  useEffect(() => {
    if (playing) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  // A lejátszófej és az éppen szóló ütés betűje követi a kottát.
  useEffect(() => {
    const on = playing && step > 0;
    const pos = on ? (step - 1) / (SCORE_DIV * ex.meter) : -1;
    const bar = Math.floor(pos);
    box.current?.querySelectorAll('svg').forEach((svg, i) => {
      setPlayhead(svg, on && i === bar ? 0 : -1, pos - bar);
      const slot = Math.floor((pos - bar) * ex.bars[i].length);
      svg.querySelectorAll('.stroke-letter').forEach((el, k) => el.classList.toggle('on', on && i === bar && k === slot));
    });
  }, [playing, step, ex, html]);

  return (
    <section className={`stroke-ex tone-3 ${ex.bars.length > 1 ? 'full' : ex.meter === 4 ? 'wide' : ''}`}>
      <header>
        <b>{ex.n}</b>
        <span>{ex.meter}/4</span>
        <button
          type="button"
          className="play-btn"
          aria-label={`${playing ? t.stop : t.play}: ${ex.n}`}
          onClick={() => toggle(playId, sound, { bpm, loop: true, div: SCORE_DIV, track: true })}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>
      </header>
      <div className="score stroke-score" ref={box} dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

/** A Strokes tananyag: fölül az animált ütéstípusok, alattuk sorban a gyakorlatok, közös tempóval. */
export function StrokesLesson() {
  const { pick } = useI18n();
  const { stop } = usePlayback();
  const [bpm, setBpm] = useState(70);

  useEffect(() => {
    void preloadSamples();
    return stop;
  }, [stop]);

  return (
    <div className="strokes">
      <div className="stroke-types">
        {STROKE_TYPES.map((s, i) => (
          <StrokeTile key={s.letter} stroke={s} tone={(i + (i >> 1)) % 2} />
        ))}
      </div>
      <p className="muted">
        {pick(
          'A betűk az ütéstípust jelölik, alattuk a két kézrend: előbb jobbal, aztán ballal kezdve. Az F és a D hangsúlyos, a T és az U halk.',
          'The letters show the stroke type, with both stickings below: first leading with the right, then with the left. F and D are accented, T and U are soft.',
        )}
      </p>
      <label className="slider tempo stroke-tempo">
        <span>
          {pick('Tempó', 'Tempo')} <b>{bpm} BPM</b>
        </span>
        <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
      </label>
      <div className="stroke-exercises">
        {STROKE_EXERCISES.map((ex) => (
          <ExerciseTile key={ex.n} ex={ex} bpm={bpm} />
        ))}
      </div>
    </div>
  );
}
