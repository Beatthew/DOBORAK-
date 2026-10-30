import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { SongEngine } from '../songs/engine';

interface Mix {
  band: number;
  drums: number;
  tempo: number;
  metro: number;
}
const MIX0: Mix = { band: 80, drums: 100, tempo: 100, metro: 0 };
const loadMix = (): Mix => {
  try {
    return { ...MIX0, ...JSON.parse(localStorage.getItem('dj-mix') || '{}') };
  } catch {
    return MIX0;
  }
};

/** A keverő: tempó (hangmagasság-változás nélkül), band, dob, metronóm. A beállítás megmarad és a motorra hat. */
export function SongMixer({ engine }: { engine: SongEngine | null }) {
  const { pick } = useI18n();
  const [mix, setMix] = useState(loadMix);
  const setM = (k: keyof Mix, v: number) => setMix((m) => ({ ...m, [k]: v }));

  useEffect(() => {
    try {
      localStorage.setItem('dj-mix', JSON.stringify(mix));
    } catch {
      /* privát mód */
    }
    if (!engine) return;
    engine.setVol('Band', mix.band / 100);
    engine.setVol('Drums', mix.drums / 100);
    engine.setVol('Metro', mix.metro / 100);
    const t = setTimeout(() => engine.setRate(mix.tempo / 100), 150);   // húzás közben nem indul újra minden lépésnél
    return () => clearTimeout(t);
  }, [engine, mix]);

  return (
    <section className="mixer-card">
      <Slider label={pick('Tempó', 'Tempo')} value={mix.tempo} min={50} max={100} unit="%" onChange={(v) => setM('tempo', v)}>
        <div className="quick">
          {[50, 75, 90, 100].map((p) => (
            <button key={p} className={mix.tempo === p ? 'on' : ''} onClick={() => setM('tempo', p)}>
              {p}%
            </button>
          ))}
        </div>
      </Slider>
      <Slider label="Band" value={mix.band} onChange={(v) => setM('band', v)} />
      <Slider label={pick('Dob', 'Drums')} value={mix.drums} onChange={(v) => setM('drums', v)} />
      <Slider label={pick('Metronóm', 'Metronome')} value={mix.metro} onChange={(v) => setM('metro', v)} />
    </section>
  );
}

function Slider(props: { label: string; value: number; min?: number; max?: number; unit?: string; onChange: (v: number) => void; children?: React.ReactNode }) {
  const { label, value, min = 0, max = 100, unit = '', onChange, children } = props;
  return (
    <label className="slider">
      <span>
        {label} <b>{value}{unit}</b>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
      {children}
    </label>
  );
}
