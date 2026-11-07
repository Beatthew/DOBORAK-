import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { preloadSamples, SCORE_DIV, scoreBars } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { handHits, handMotion, STROKE_EXERCISES, STROKE_TYPES, strokeBeats, strokeHeight, type Hand, type StrokeExercise, type StrokeType } from '../data/strokes';
import { useI18n } from '../i18n';
import { PracticeMixer } from './Score';
import { setPlayhead, strokeBarSVG } from '../songs/notation';
import { PlayIcon, StopIcon } from './Icons';

const ANGLE = { high: 36, low: 6 };
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
      <svg className="stroke-anim" viewBox="0 -14 160 114" aria-hidden="true">
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

const exerciseSVGs = (ex: StrokeExercise) =>
  ex.bars
    .map((bar, i) =>
      strokeBarSVG(strokeBeats(bar, ex.meter, false), bar, ex.hands, ex.meter === 2 ? 230 : 400, {
        open: i === 0,
        close: i === ex.bars.length - 1,
      }),
    )
    .join('');

/* A két verő első személyben, a padra nézve: a markolat a kép alján, a hegy a bőr felé. */
const GEOMETRY: Record<Hand, { butt: [number, number]; tip: [number, number] }> = {
  L: { butt: [24, 212], tip: [132, 124] },
  R: { butt: [296, 212], tip: [188, 124] },
};
const HANDS: Hand[] = ['L', 'R'];
const LIFT = 105;
const RING_SECONDS = 0.28;

/** ring: az ütés körének állapota, 0 = most ütött, 1 = már nem látszik. */
function placeStick(g: SVGGElement | null | undefined, hand: Hand, height: number, ring: number, loud: boolean) {
  if (!g) return;
  const { butt, tip } = GEOMETRY[hand];
  const reach = 1 - 0.1 * height;
  const x = butt[0] + (tip[0] - butt[0]) * reach;
  const y = butt[1] + (tip[1] - butt[1]) * reach - height * LIFT;
  const line = g.querySelector('line')!;
  line.setAttribute('x2', String(x));
  line.setAttribute('y2', String(y));
  const bead = g.querySelector('.stick-tip')!;
  bead.setAttribute('cx', String(x));
  bead.setAttribute('cy', String(y));
  g.querySelector('.stick-shadow')!.setAttribute('opacity', String(0.28 * (1 - height * 0.7)));
  const hit = g.querySelector('.stick-hit')!;
  const size = (loud ? 30 : 17) * (0.45 + ring * 0.75);
  hit.setAttribute('opacity', String(1 - ring));
  hit.setAttribute('rx', String(size));
  hit.setAttribute('ry', String(size * 0.38));
}

interface OverlayProps {
  ex: StrokeExercise;
  bpm: number;
  onBpm: (bpm: number) => void;
  lead: 0 | 1;
  onLead: (lead: 0 | 1) => void;
  onClose: () => void;
}

/** Egy gyakorlat: fölül a két kéz mozgása, alatta a kotta; a kézrend váltása a futó lejátszást nem állítja meg. */
function ExerciseOverlay({ ex, bpm, onBpm, lead, onLead, onClose }: OverlayProps) {
  const { t, pick } = useI18n();
  const { playingId, step, toggle, stop } = usePlayback();
  const dialog = useRef<HTMLDialogElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const sticks = useRef<Partial<Record<Hand, SVGGElement | null>>>({});
  const anchor = useRef<{ pos: number; at: number } | null>(null);
  const playId = `stroke:${ex.n}`;
  const playing = playingId === playId;
  const html = useMemo(() => exerciseSVGs(ex), [ex]);
  const sound = useMemo(() => scoreBars(ex.bars.map((bar) => strokeBeats(bar, ex.meter, true))), [ex]);
  const barSteps = SCORE_DIV * ex.meter;
  const loop = barSteps * ex.bars.length;
  const stepSeconds = 60 / bpm / SCORE_DIV;
  const title = pick(`${ex.n}. gyakorlat`, `Exercise ${ex.n}`);

  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (playing) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  // A lépések csak az órát igazítják: a mozgást a képkockaidő simítja, így lassú tempón sem darabos.
  useEffect(() => {
    if (!playing || step === 0) {
      anchor.current = null;
      return;
    }
    const a = anchor.current;
    const now = performance.now();
    const drift = a ? (a.pos + (now - a.at) / 1000 / stepSeconds - (step - 1) + loop) % loop : loop / 2;
    if (Math.min(drift, loop - drift) > 2) anchor.current = { pos: step - 1, at: now };
  }, [playing, step, loop, stepSeconds]);

  useEffect(() => {
    const hits = handHits(ex, lead, SCORE_DIV);
    const svgs = box.current ? [...box.current.querySelectorAll('svg')] : [];
    let raf = 0;
    const frame = () => {
      const a = anchor.current;
      const pos = a ? (a.pos + (performance.now() - a.at) / 1000 / stepSeconds) % loop : -1;
      HANDS.forEach((hand) => {
        if (pos < 0) {
          // áll: mindkét kéz a saját első ütésének kezdőmagasságán vár
          placeStick(sticks.current[hand], hand, strokeHeight(hits[hand][0].stroke.from), 1, false);
          return;
        }
        const { height, since, stroke } = handMotion(hits[hand], loop, pos);
        placeStick(sticks.current[hand], hand, height, Math.min(1, (since * stepSeconds) / RING_SECONDS), stroke.letter === 'F' || stroke.letter === 'D');
      });
      const bar = pos < 0 ? -1 : Math.floor(pos / barSteps);
      const frac = pos < 0 ? 0 : pos / barSteps - bar;
      svgs.forEach((svg, i) => {
        setPlayhead(svg, i === bar ? 0 : -1, frac);
        const slot = Math.floor(frac * ex.bars[i].length);
        svg.querySelectorAll('.stroke-letter').forEach((el, k) => el.classList.toggle('on', i === bar && k === slot));
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ex, lead, loop, barSteps, stepSeconds]);

  return (
    <dialog
      ref={dialog}
      className="stroke-dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="stroke-dialog-body">
        <header>
          <h3>{title}</h3>
          <span>{ex.meter}/4</span>
          <button type="button" className="stroke-close" aria-label={pick('Bezárás', 'Close')} onClick={() => dialog.current?.close()}>
            ×
          </button>
        </header>
        <div className="stroke-hands tone-0">
          <svg viewBox="0 0 320 190" role="img" aria-label={pick('A két verő mozgása a kézrend szerint', 'Both sticks moving with the sticking')}>
            <ellipse cx="160" cy="124" rx="104" ry="40" fill="currentColor" opacity="0.14" />
            <ellipse cx="160" cy="124" rx="104" ry="40" fill="none" stroke="currentColor" strokeWidth="5" />
            {HANDS.map((hand) => (
              <g key={hand} ref={(el) => { sticks.current[hand] = el; }}>
                <ellipse className="stick-shadow" cx={GEOMETRY[hand].tip[0]} cy={GEOMETRY[hand].tip[1]} rx="9" ry="3.5" fill="currentColor" />
                <ellipse className="stick-hit" cx={GEOMETRY[hand].tip[0]} cy={GEOMETRY[hand].tip[1]} fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0" />
                <line x1={GEOMETRY[hand].butt[0]} y1={GEOMETRY[hand].butt[1]} stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                <circle className="stick-tip" r="6.5" fill="currentColor" />
              </g>
            ))}
            <text x="14" y="178" fontSize="20" fontWeight="900" fill="currentColor">L</text>
            <text x="306" y="178" fontSize="20" fontWeight="900" fill="currentColor" textAnchor="end">R</text>
          </svg>
        </div>
        <div className="seg stroke-lead" role="group" aria-label={pick('Kezdő kéz', 'Leading hand')}>
          <button type="button" className={lead === 0 ? 'on' : ''} aria-pressed={lead === 0} onClick={() => onLead(0)}>
            {pick('Jobbról kezdve', 'Right lead')}
          </button>
          <button type="button" className={lead === 1 ? 'on' : ''} aria-pressed={lead === 1} onClick={() => onLead(1)}>
            {pick('Balról kezdve', 'Left lead')}
          </button>
        </div>
        <div className="stroke-sheet tone-3">
          <div className="score stroke-score" data-lead={lead} ref={box} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div className="transport">
          <button
            type="button"
            className="play-btn"
            aria-label={playing ? t.stop : t.play}
            onClick={() => toggle(playId, sound, { bpm, loop: true, div: SCORE_DIV, track: true })}
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
        <PracticeMixer />
      </div>
    </dialog>
  );
}

/** A Strokes tananyag: fölül az animált ütéstípusok, alattuk sorban a gyakorlatok; egy gyakorlat overlayben nyílik. */
export function StrokesLesson() {
  const { pick } = useI18n();
  const [bpm, setBpm] = useState(70);
  const [lead, setLead] = useState<0 | 1>(0);
  const [open, setOpen] = useState<StrokeExercise | null>(null);

  useEffect(() => {
    void preloadSamples();
  }, []);

  return (
    <div className="strokes">
      <div className="stroke-types">
        {STROKE_TYPES.map((s, i) => (
          <StrokeTile key={s.letter} stroke={s} tone={(i + (i >> 1)) % 2} />
        ))}
      </div>
      <p className="muted">
        {pick(
          'A betűk az ütéstípust jelölik, alattuk a két kézrend: előbb jobbal, aztán ballal kezdve. Egy gyakorlatra koppintva megnyílik a lejátszás és a két kéz mozgása.',
          'The letters show the stroke type, with both stickings below: first leading with the right, then with the left. Tap an exercise to open playback and see both hands move.',
        )}
      </p>
      <div className="stroke-exercises">
        {STROKE_EXERCISES.map((ex) => (
          <button
            key={ex.n}
            type="button"
            className={`stroke-ex tone-3 ${ex.bars.length > 1 ? 'full' : ex.meter === 4 ? 'wide' : ''}`}
            aria-label={pick(`${ex.n}. gyakorlat megnyitása`, `Open exercise ${ex.n}`)}
            onClick={() => setOpen(ex)}
          >
            <span className="stroke-ex-head">
              <b>{ex.n}</b>
              <span>{ex.meter}/4</span>
            </span>
            <span className="score stroke-score" dangerouslySetInnerHTML={{ __html: exerciseSVGs(ex) }} />
          </button>
        ))}
      </div>
      {open && <ExerciseOverlay ex={open} bpm={bpm} onBpm={setBpm} lead={lead} onLead={setLead} onClose={() => setOpen(null)} />}
    </div>
  );
}
