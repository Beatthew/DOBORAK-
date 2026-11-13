import { useMemo, useState } from 'react';
import { KICK_PERMS, permutationBar, type KickPerm } from '../data/kickPermutations';
import { toBeats } from '../data/library';
import { useI18n } from '../i18n';
import { ScorePlayer } from './Score';

const SLOT_X = [22, 52, 82, 112];

/** Egy negyednyi lábdob-ritmus: tizenhatodok egy vonalon, az üres helyeken szünetjel. */
function PermRhythm({ hits }: { hits: number[] }) {
  const stems = hits.map((s) => SLOT_X[s] + 6);
  return (
    <svg className="perm-rhythm" viewBox="0 0 140 64" aria-hidden="true">
      <path d="M4 48H136" stroke="currentColor" strokeWidth="1.2" />
      {SLOT_X.map((x, s) =>
        hits.includes(s) ? (
          <g key={s}>
            <ellipse cx={x} cy="48" rx="6.5" ry="4.8" transform={`rotate(-20 ${x} 48)`} fill="currentColor" />
            <path d={`M${x + 6} 47V10`} stroke="currentColor" strokeWidth="1.6" />
          </g>
        ) : (
          <g key={s} fill="currentColor">
            <circle cx={x - 2} cy="40" r="2.6" />
            <circle cx={x - 5} cy="49" r="2.6" />
            <path d={`M${x - 2} 41q4 1 6 -4L${x - 1} 60M${x - 5} 50q4 1 6 -4`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ),
      )}
      {stems.length === 1 ? (
        <path d={`M${stems[0]} 10c2 7 11 9 9 19M${stems[0]} 17c2 7 11 9 9 19`} fill="none" stroke="currentColor" strokeWidth="2" />
      ) : (
        [8, 16].map((y) => (
          <rect key={y} x={stems[0] - 0.8} y={y} width={stems[stems.length - 1] - stems[0] + 1.6} height="4.5" fill="currentColor" />
        ))
      )}
    </svg>
  );
}

/** A lábdob nélküli alap groove kottája fent, alatta a 15 permutáció: amelyikre koppint, az kerül a groove minden negyedére. */
export function KickPermutations() {
  const { pick } = useI18n();
  const [picked, setPicked] = useState<KickPerm | null>(null);
  const [bpm, setBpm] = useState(70);
  const bars = useMemo(() => [toBeats(permutationBar(picked))], [picked]);

  return (
    <div className="kick-perms">
      <ScorePlayer id="kick-perms" bars={bars} bpm={bpm} onBpm={setBpm} min={50} max={120} restartOnChange />
      <p className="muted">
        {picked
          ? pick(`${picked.letter} permutáció a groove minden negyedén. Koppints egy másikra, vagy újra erre a lábdob nélküli groove-hoz.`, `Permutation ${picked.letter} on every beat of the groove. Tap another one, or this one again for the groove without kick.`)
          : pick('Válassz egy lábdob-ritmust: a groove mind a négy negyedére rákerül.', 'Pick a kick rhythm: it goes onto all four beats of the groove.')}
      </p>
      <div className="perm-list">
        {KICK_PERMS.map((p) => (
          <button
            key={p.letter}
            type="button"
            className={`perm-btn${picked === p ? ' on' : ''}`}
            aria-pressed={picked === p}
            aria-label={pick(`${p.letter} permutáció: lábdob a(z) ${p.hits.map((s) => s + 1).join(', ')}. tizenhatodon`, `Permutation ${p.letter}: kick on sixteenth ${p.hits.map((s) => s + 1).join(', ')}`)}
            onClick={() => setPicked(picked === p ? null : p)}
          >
            <b>{p.letter}</b>
            <PermRhythm hits={p.hits} />
          </button>
        ))}
      </div>
    </div>
  );
}
