import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { SongEngine } from '../songs/engine';

interface Mix {
  band: number;
  drums: number;
  tempo: number;
  metro: number;
  /** némított csatornák */
  muted: { band?: boolean; drums?: boolean; metro?: boolean };
}
type Channel = 'band' | 'drums' | 'metro';
const MIX0: Mix = { band: 80, drums: 100, tempo: 100, metro: 0, muted: {} };
const loadMix = (): Mix => {
  try {
    const m = { ...MIX0, ...JSON.parse(localStorage.getItem('dj-mix') || '{}') };
    return { ...m, muted: m.muted ?? {} };
  } catch {
    return MIX0;
  }
};

const CHANNELS: [Channel, string, string, string][] = [
  ['band', 'BAND', 'BAND', '#9fd3c7'],
  ['drums', 'DOB', 'DRUMS', '#70f8ba'],
  ['metro', 'KLIKK', 'CLICK', '#f0dcca'],
];

/** A keverő: band, dob, klikk (metronóm) csatornák némítással, és a tempó (hangmagasság-változás nélkül).
 *  A beállítás megmarad és a motorra hat. „phone”: sötét kártya vízszintes faderekkel (a diák nézete),
 *  „console”: függőleges keverőpult szintjelzővel (a szerkesztő oldalsávja). */
export function SongMixer({ engine, variant = 'phone' }: { engine: SongEngine | null; variant?: 'phone' | 'console' }) {
  const { pick } = useI18n();
  const [mix, setMix] = useState(loadMix);
  const setM = (k: Channel | 'tempo', v: number) => setMix((m) => ({ ...m, [k]: v }));
  const toggleMute = (k: Channel) => setMix((m) => ({ ...m, muted: { ...m.muted, [k]: !m.muted[k] } }));
  const vol = (k: Channel) => (mix.muted[k] ? 0 : mix[k] / 100);

  useEffect(() => {
    try {
      localStorage.setItem('dj-mix', JSON.stringify(mix));
    } catch {
      /* privát mód */
    }
    if (!engine) return;
    engine.setVol('Band', vol('band'));
    engine.setVol('Drums', vol('drums'));
    engine.setVol('Metro', vol('metro'));
    const t = setTimeout(() => engine.setRate(mix.tempo / 100), 150);   // húzás közben nem indul újra minden lépésnél
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, mix]);

  const tempo = (
    <div className="mx-tempo">
      <div className="mx-tempo-head">
        <small>{pick('TEMPÓ', 'TEMPO')}</small>
      </div>
      <div className="mx-tempo-row">
        <button type="button" aria-label={pick('Lassabb', 'Slower')} onClick={() => setM('tempo', Math.max(50, mix.tempo - 5))}>−</button>
        <b>{mix.tempo}%</b>
        <button type="button" aria-label={pick('Gyorsabb', 'Faster')} onClick={() => setM('tempo', Math.min(100, mix.tempo + 5))}>+</button>
      </div>
      <div className="mx-quick">
        {[50, 75, 90, 100].map((p) => (
          <button key={p} type="button" className={mix.tempo === p ? 'on' : ''} onClick={() => setM('tempo', p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className={`mixer mixer-${variant}`} aria-label={pick('Keverő', 'Mixer')}>
      <div className="mx-head">
        <b>{pick('KEVERŐ', 'MIXER')}</b>
      </div>
      <div className="mx-channels">
        {CHANNELS.map(([k, hu, en, color]) => {
          const v = mix[k], off = !!mix.muted[k] || v === 0;
          return (
            <div key={k} className={`mx-ch${off ? ' off' : ''}`} style={{ '--ch': color, '--v': `${v}%` } as React.CSSProperties}>
              <span className="mx-name">{pick(hu, en)}</span>
              <input
                className="mx-fader"
                type="range"
                min={0}
                max={100}
                value={v}
                onChange={(e) => setM(k, +e.target.value)}
                aria-label={`${pick(hu, en)} ${pick('hangerő', 'volume')}`}
              />
              <b className="mx-val">{v}</b>
              <button type="button" className={`mx-mute${mix.muted[k] ? ' on' : ''}`} onClick={() => toggleMute(k)} aria-pressed={!!mix.muted[k]} aria-label={`${pick(hu, en)} ${pick('némítása', 'mute')}`}>
                M
              </button>
            </div>
          );
        })}
      </div>
      {tempo}
    </section>
  );
}
