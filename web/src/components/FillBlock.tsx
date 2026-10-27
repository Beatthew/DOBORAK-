import { fillBars } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { useI18n } from '../i18n';
import type { Fill } from '../types';
import { PlayIcon, StopIcon } from './Icons';
import { StaffNotation } from './StaffNotation';

export function FillBlock({ fill, bpm }: { fill: Fill; bpm: number }) {
  const { t, pick } = useI18n();
  const { playingId, toggle } = usePlayback();
  const id = `fill:${fill.id}`;
  const playing = playingId === id;
  const title = pick(fill.titleHu, fill.titleEn);

  return (
    <section id={`fill-${fill.id}`} className="groove-block fill-block tone-2">
      <div className="groove-head">
        <div>
          <h2>{fill.name}</h2>
          <div className="fill-sub">{title}</div>
        </div>
        <button
          type="button"
          className="play"
          aria-label={`${playing ? t.stop : t.play}: ${fill.name}`}
          onClick={() => toggle(id, fillBars(fill), { bpm, loop: false })}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>
      </div>
      <StaffNotation fill={fill} label={`${fill.name}: ${title}`} />
    </section>
  );
}
