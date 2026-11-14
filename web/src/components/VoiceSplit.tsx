import { useMemo, useState } from 'react';
import { splitBar, VOICE_NAME, VOICE_SETS, VOICE_SPLIT_GROOVE, type VoiceSet } from '../data/voiceSplit';
import { toBeats } from '../data/library';
import { useI18n } from '../i18n';
import { ScorePlayer } from './Score';

/** A dal groove-ja fent; alatta a szólampárosítások: amelyikre koppint, csak azok a hangszerek maradnak a kottában. */
export function VoiceSplit() {
  const { pick } = useI18n();
  const [picked, setPicked] = useState<VoiceSet>(VOICE_SETS[0]);
  const [bpm, setBpm] = useState(70);
  const bars = useMemo(() => [toBeats(splitBar(VOICE_SPLIT_GROOVE, picked.voices))], [picked]);
  const name = (s: VoiceSet) =>
    s.voices.length === 3 ? pick('Teljes groove', 'Full groove') : s.voices.map((v) => pick(...VOICE_NAME[v])).join(' + ');

  const group = (title: string, sets: VoiceSet[]) => (
    <section className="voice-group">
      <h3>{title}</h3>
      <div className="voice-list">
        {sets.map((s) => (
          <button key={s.id} type="button" className={`voice-btn${picked === s ? ' on' : ''}`} aria-pressed={picked === s} onClick={() => setPicked(s)}>
            <b>{name(s)}</b>
            <span className="voice-chips" aria-hidden="true">
              {(['h', 's', 'k'] as const).map((v) => (
                <i key={v} className={s.voices.includes(v) ? 'in' : ''}>{pick(...VOICE_NAME[v])}</i>
              ))}
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="voice-split">
      <ScorePlayer id="voice-split" bars={bars} bpm={bpm} onBpm={setBpm} min={50} max={140} restartOnChange />
      <p className="muted">
        {pick(
          `${name(picked)}. A harmadik lábdob a „hár”-ról a „mat”-ra csúszik: egy – tőt – mat.`,
          `${name(picked)}. The third kick slides from “3” to “3&”: 1 – 2& – 3&.`,
        )}
      </p>
      {group(pick('Szólampárok', 'Pairs'), VOICE_SETS.filter((s) => s.voices.length === 2))}
      {group(pick('Egy szólam', 'One voice'), VOICE_SETS.filter((s) => s.voices.length === 1))}
      {group(pick('Együtt', 'Together'), VOICE_SETS.filter((s) => s.voices.length === 3))}
    </div>
  );
}
