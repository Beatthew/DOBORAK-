import { Fragment } from 'react';
import { exerciseBars, partSteps } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { findFill, findGroove, grooveTone } from '../data/lessons';
import { useI18n } from '../i18n';
import type { Exercise, Part } from '../types';
import { CrashIcon, DrumIcon, HiHatIcon, PlayIcon, RideIcon, StopIcon, SwapIcon } from './Icons';

interface Props {
  exercise: Exercise;
  bpm: number;
  index: number;
}

export function ExerciseCard({ exercise, bpm, index }: Props) {
  const { t, pick } = useI18n();
  const { playingId, step, toggle } = usePlayback();
  const id = `exercise:${exercise.id}`;
  const playing = playingId === id;
  const title = pick(exercise.titleHu, exercise.titleEn);
  const note = pick(exercise.noteHu, exercise.noteEn);
  const parts = exercise.parts;

  // Which tile is sounding, and how far through its turn it is.
  const lengths = parts.map(partSteps);
  const passLen = lengths.reduce((a, b) => a + b, 0);
  const fills = parts.map(() => 0);
  if (playing && step > 0 && step <= passLen * 2) {
    let pos = (step - 1) % passLen;
    for (let i = 0; i < parts.length; i++) {
      if (pos < lengths[i]) {
        fills[i] = (pos + 1) / lengths[i];
        break;
      }
      pos -= lengths[i];
    }
  }

  // A crash tile sits before every part that starts on the crash; plain arrows elsewhere.
  // Long exercises wrap two parts to a row, so tiles stay readable on a phone.
  const crashBefore = (i: number) => {
    const part = parts[i];
    return part.kind === 'groove' && !!part.crash;
  };
  const rows: number[][] = [];
  parts.forEach((_, i) => (i % 2 === 0 ? rows.push([i]) : rows[rows.length - 1].push(i)));

  const tile = (part: Part) => {
    if (part.kind === 'fill') {
      const fill = findFill(part.fillId);
      return (
        <div className="tile tone-2">
          <div className="tile-groove">{fill?.name}</div>
          <DrumIcon />
          <div className="tile-name">
            {fill ? pick(fill.titleHu, fill.titleEn) : ''} · {t.bars(1)}
          </div>
        </div>
      );
    }
    const groove = findGroove(part.grooveId);
    return (
      <div className={`tile tone-${grooveTone(part.grooveId)}`}>
        <div className="tile-groove">{groove?.name}</div>
        {part.cymbal === 'ride' ? <RideIcon /> : <HiHatIcon />}
        <div className="tile-name">
          {part.cymbal === 'ride' ? t.ride : t.hh} · {t.bars(part.bars)}
        </div>
      </div>
    );
  };

  return (
    <article className="exercise">
      <div className="exercise-head">
        <div className="exercise-num">{index + 1}</div>
        <h3>{title}</h3>
        <button
          type="button"
          className="play play-sm"
          aria-label={`${playing ? t.stop : t.playTwice}: ${title}`}
          onClick={() => toggle(id, exerciseBars(exercise, findGroove, findFill), { bpm, loop: false })}
        >
          {playing ? <StopIcon size={20} /> : <PlayIcon size={20} />}
        </button>
      </div>
      {rows.map((row) => (
        <Fragment key={row[0]}>
          {row[0] > 0 && crashBefore(row[0]) && (
            <div className="row-lead">
              <CrashIcon />
              {t.crash}
            </div>
          )}
          <div
            className="exercise-row"
            style={{
              gridTemplateColumns: row
                .map((i, k) => (k === 0 ? '' : crashBefore(i) ? '72px ' : '28px ') + 'minmax(0, 1fr)')
                .join(' '),
            }}
          >
            {row.map((i, k) => (
              <Fragment key={i}>
                {k > 0 &&
                  (crashBefore(i) ? (
                    <div className="tile-crash">
                      <CrashIcon />
                      <div className="tile-groove">{t.crash}</div>
                      <SwapIcon />
                    </div>
                  ) : (
                    <div className="tile-swap">
                      <SwapIcon />
                    </div>
                  ))}
                {tile(parts[i])}
              </Fragment>
            ))}
            {row.map((i, k) => (
              <Fragment key={i}>
                {k > 0 && <span />}
                <div className="track">
                  <div className="track-fill" style={{ width: `${fills[i] * 100}%` }} />
                </div>
              </Fragment>
            ))}
          </div>
        </Fragment>
      ))}
      {note && <p className="exercise-note">{note}</p>}
    </article>
  );
}
