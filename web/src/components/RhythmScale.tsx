import { useMemo, useState } from 'react';
import { RHYTHM_LEVELS, scaleBar, type RhythmLevel } from '../data/rhythmScale';
import { toBeats } from '../data/library';
import { useI18n } from '../i18n';
import { ScorePlayer } from './Score';

const LOOP = 'loop';

/** Együtemes kotta fent; alatta a fokok (negyed, nyolcad, tizenhatod) és a Loop, ami egymás után játssza őket. */
export function RhythmScale() {
  const { pick } = useI18n();
  const [mode, setMode] = useState<string>(RHYTHM_LEVELS[0].id);
  const [kick, setKick] = useState(false);
  const [bpm, setBpm] = useState(70);
  const [reps, setReps] = useState<Record<string, number>>(() => Object.fromEntries(RHYTHM_LEVELS.map((l) => [l.id, 4])));
  const loop = mode === LOOP;

  // Loop módban minden fok annyiszor, ahányra állították; a kotta mindig az épp szóló ütemet mutatja.
  const plan = useMemo(() => {
    const levels: RhythmLevel[] = loop ? RHYTHM_LEVELS.flatMap((l) => Array<RhythmLevel>(reps[l.id]).fill(l)) : RHYTHM_LEVELS.filter((l) => l.id === mode);
    return { levels, bars: levels.map((l) => toBeats(scaleBar(l, kick))) };
  }, [loop, mode, reps, kick]);

  const name = (l: RhythmLevel) => pick(...l.name);
  const caption = (i: number) => {
    const l = plan.levels[i];
    const first = plan.levels.indexOf(l);
    return `${name(l)} · ${i - first + 1}/${reps[l.id]}`;
  };
  const bump = (id: string, d: number) => setReps((r) => ({ ...r, [id]: Math.min(16, Math.max(1, r[id] + d)) }));

  return (
    <div className="rhythm-scale">
      <ScorePlayer id="rhythm-scale" bars={plan.bars} bpm={bpm} onBpm={setBpm} min={40} max={160} restartOnChange follow={loop} caption={loop ? caption : undefined} />
      <nav className="scale-pills" aria-label={pick('Felosztás', 'Subdivision')}>
        {RHYTHM_LEVELS.map((l) => (
          <button key={l.id} type="button" className={mode === l.id ? 'on' : ''} aria-pressed={mode === l.id} onClick={() => setMode(l.id)}>
            {name(l)}
          </button>
        ))}
        <button type="button" className={`loop-pill${loop ? ' on' : ''}`} aria-pressed={loop} onClick={() => setMode(LOOP)}>
          Loop
        </button>
      </nav>
      <label className="scale-kick">
        <input type="checkbox" checked={kick} onChange={(e) => setKick(e.target.checked)} />
        <span>{pick('Lábdob a negyedeken (metronómként)', 'Kick on the quarters (as a metronome)')}</span>
      </label>
      {loop ? (
        <section className="loop-panel">
          <p className="muted">{pick('Végigmegy a skálán, aztán kezdi elölről. Hány ütemig maradjon egy-egy fokon?', 'Runs up the scale, then starts again. How many bars on each step?')}</p>
          {RHYTHM_LEVELS.map((l) => (
            <div key={l.id} className="loop-row">
              <span>{name(l)}</span>
              <button type="button" className="btn small" aria-label={pick(`${name(l)}: kevesebb`, `${name(l)}: fewer`)} onClick={() => bump(l.id, -1)} disabled={reps[l.id] <= 1}>−</button>
              <b aria-live="polite">{reps[l.id]}×</b>
              <button type="button" className="btn small" aria-label={pick(`${name(l)}: több`, `${name(l)}: more`)} onClick={() => bump(l.id, 1)} disabled={reps[l.id] >= 16}>+</button>
            </div>
          ))}
        </section>
      ) : (
        <p className="muted">{pick('Váltott kézzel, jobbal kezdve. Ha megy, válts a következő fokra, vagy indítsd a Loopot.', 'Alternate hands, starting right. Once it sits, move up a step or start the Loop.')}</p>
      )}
    </div>
  );
}
