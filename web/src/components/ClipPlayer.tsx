import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayback } from '../audio/playback';
import { useI18n } from '../i18n';
import { SongEngine } from '../songs/engine';
import { rowSVG, setPlayhead } from '../songs/notation';
import type { Beats, SongData } from '../songs/types';
import { PlayIcon, StopIcon } from './Icons';
import { SongMixer } from './SongMixer';

/** Egy dalból kivágott részlet: a kottája, a saját felvételén ismételve, alatta a keverővel. */
export function ClipPlayer({ clip }: { clip: SongData }) {
  const { t, pick } = useI18n();
  const { stop } = usePlayback();
  const [engine, setEngine] = useState<SongEngine | null>(null);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(1);
  const bigBox = useRef<HTMLDivElement>(null), stripBox = useRef<HTMLDivElement>(null);
  const lastBar = clip.score.length - 1;

  useEffect(() => {
    let alive = true;
    let loaded: SongEngine | null = null;
    SongEngine.load(clip)
      .then((e) => {
        if (!alive) return e.close();
        loaded = e;
        e.setLoop(e.timing.range(1, lastBar));
        setEngine(e);
      })
      .catch((e) => alive && setErr(String(e.message || e)));
    return () => {
      alive = false;
      loaded?.close();
    };
  }, [clip, lastBar]);

  const toggle = useCallback(() => {
    if (!engine) return;
    if (engine.playing) engine.pause();
    else {
      stop();
      engine.play();
    }
    setPlaying(engine.playing);
  }, [engine, stop]);

  const svgs = useMemo(() => {
    const bars = clip.score.slice(1) as Beats[];
    return {
      big: rowSVG([bars[0]], [''], 560),
      strip: rowSVG(bars, bars.map((_, i) => i + 1), 420 * bars.length),
    };
  }, [clip]);

  // lejátszófej: képkockánként, közvetlenül az SVG-ben (React újrarajzolás nélkül)
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const tm = engine.timing, pos = tm.barPos(engine.time()), b = Math.min(tm.barAt(engine.time()), lastBar), frac = pos - Math.floor(pos);
      setBar((old) => (old === b ? old : b));
      const on = engine.playing;
      setPlayhead(bigBox.current?.querySelector('svg') ?? null, on ? 0 : -1, frac, true);
      setPlayhead(stripBox.current?.querySelector('svg') ?? null, on ? b - 1 : -1, frac);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [engine, lastBar]);

  return (
    <div className="clip-player">
      <section className="score-card">
        <div className="score-big" ref={bigBox} dangerouslySetInnerHTML={{ __html: svgs.big }} />
        <div className="score-strip" ref={stripBox} dangerouslySetInnerHTML={{ __html: svgs.strip }} />
        <div className="transport">
          <button type="button" className="play-btn" onClick={toggle} disabled={!engine} aria-label={playing ? t.stop : t.play}>
            {playing ? <StopIcon /> : <PlayIcon />}
          </button>
          <div className="transport-info">
            {err ? (
              <span className="error-text">{pick('A hangsávok nem töltődtek be', 'The audio tracks did not load')}: {err}</span>
            ) : !engine ? (
              <span>{pick('Hangsávok betöltése…', 'Loading audio tracks…')}</span>
            ) : (
              <span>{pick(`${bar}. ütem / ${lastBar} · ismétlődik`, `Bar ${bar} / ${lastBar} · looping`)}</span>
            )}
          </div>
        </div>
      </section>
      <SongMixer engine={engine} />
    </div>
  );
}
