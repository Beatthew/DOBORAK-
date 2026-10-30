import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { TopBar } from '../components/TopBar';
import { SongEngine } from '../songs/engine';
import { findSongData } from '../songs';
import { fitWidth, marksOf, rowSVG, setPlayhead } from '../songs/notation';
import type { Beats, SongData } from '../songs/types';

/* Egy dal gyakorlása a BEATHUB felületén, a Song Practice motorjával.
   Fülek: Groove-ok / Fillek (a dal építőelemei, mindegyik a dal saját részletén loopolva) és Teljes szám
   (az egész dal, vagy egy szekciója loopolva). Lent: lejátszás, tempó (hangmagasság-változás nélkül), keverő.
   Kiválasztás az URL-ben: /dal/<id>/<kulcs> — e3 (3. elem), e3v1 (variációja), all (teljes szám), s2 (2. szekció). */

type Tab = 'groove' | 'fill' | 'song';
const TABS: [Tab, string][] = [
  ['groove', 'Groove-ok'],
  ['fill', 'Fillek'],
  ['song', 'Teljes szám'],
];

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

interface Sel {
  key: string;
  tab: Tab;
  name: string;
  sub: string;
  /** a nagy kotta ütemei (elemnél az elem ütemei, különben a dal ütemszámai) */
  big: Beats[] | null;
  isFill: boolean;
  /** a lejátszott tartomány a dal ütemeiben; null = az egész dal, loop nélkül */
  loop: [number, number] | null;
}

function select(song: SongData, key: string): Sel {
  const els = song.elements;
  const m = /^e(\d+)(?:v(\d+))?$/.exec(key), s = /^s(\d+)$/.exec(key);
  if (m && els[+m[1]] && (!m[2] || els[+m[1]].variants[+m[2] - 1])) {
    const e = els[+m[1]], part = m[2] ? e.variants[+m[2] - 1] : e;
    const big = part.bars || [part.beats];
    return {
      key, tab: e.type, name: e.name + (m[2] ? ` · ${part.name}` : ''), isFill: e.type === 'fill', big, loop: part.loop,
      sub: `${big.length} ütemes ${e.type === 'fill' ? 'fill' : 'groove'} · a dalban: ${part.loop[0]}–${part.loop[1]}. ütem`,
    };
  }
  if (s && song.sections[+s[1]]) {
    const sec = song.sections[+s[1]];
    return { key, tab: 'song', name: sec.name, sub: `${sec.from}–${sec.to}. ütem · ismétlődik`, big: null, isFill: false, loop: [sec.from, sec.to] };
  }
  if (key === 'all') return { key, tab: 'song', name: 'Teljes szám', sub: `${song.score.length - 1} ütem`, big: null, isFill: false, loop: null };
  const first = els.findIndex((e) => e.type === 'groove');
  return select(song, first >= 0 ? `e${first}` : 'all');
}

export function SongPage() {
  const { id, sel: selKey = '' } = useParams();
  const song = findSongData(id);
  if (!song) {
    return (
      <>
        <TopBar title="Dal" backTo="/" />
        <main className="page">
          <p className="muted">Ez a dal nincs a BEATHUBban.</p>
        </main>
      </>
    );
  }
  return <SongPlayer key={song.id} song={song} selKey={selKey} />;
}

function SongPlayer({ song, selKey }: { song: SongData; selKey: string }) {
  const nav = useNavigate();
  const { pathname, state } = useLocation() as { pathname: string; state: { back?: string } | null };
  const { profile } = useAuth();
  const back = state?.back ?? (profile?.role === 'teacher' ? '/tananyag/dalok' : '/');
  const sel = useMemo(() => select(song, selKey), [song, selKey]);
  const marks = useMemo(() => marksOf(song), [song]);
  const [engine, setEngine] = useState<SongEngine | null>(null);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(sel.loop ? sel.loop[0] : 1);
  const [mix, setMix] = useState(loadMix);
  const [tab, setTab] = useState<Tab>(sel.tab);
  const engRef = useRef<SongEngine | null>(null);
  const lastBar = song.score.length - 1;

  useEffect(() => setTab(sel.tab), [sel.tab]);

  // hangsávok betöltése; a dalból kilépve minden leáll
  useEffect(() => {
    let alive = true;
    SongEngine.load(song)
      .then((e) => {
        if (!alive) return e.close();
        engRef.current = e;
        setEngine(e);
      })
      .catch((e) => alive && setErr(String(e.message || e)));
    return () => {
      alive = false;
      engRef.current?.close();
      engRef.current = null;
    };
  }, [song]);

  // keverő → motor
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

  // kiválasztás → loop + a rész elejére ugrás
  useEffect(() => {
    if (!engine) return;
    const tm = engine.timing;
    engine.setLoop(sel.loop ? tm.range(sel.loop[0], sel.loop[1]) : null);
    engine.seek(sel.loop ? tm.barStart(sel.loop[0]) : 0);
    setBar(sel.loop ? sel.loop[0] : 1);
  }, [engine, sel]);

  const toggle = useCallback(() => {
    const e = engRef.current;
    if (!e) return;
    if (e.playing) e.pause();
    else e.play();
    setPlaying(e.playing);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' || /INPUT|SELECT|TEXTAREA/.test((ev.target as HTMLElement).tagName)) return;
      ev.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // a kotta mérete a dobozhoz igazodik
  const bigBox = useRef<HTMLDivElement>(null), lineBox = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(() => setSize((n) => n + 1));
    [bigBox.current, lineBox.current].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, []);

  // ütempár a teljes szám / szekció nézethez: a szekció elejéhez igazítva, kettesével
  const secOf = (b: number) => song.sections.find((s) => b >= s.from && b <= s.to) ?? song.sections[song.sections.length - 1];
  const pairStart = (b: number) => {
    const from = sel.loop ? sel.loop[0] : secOf(b).from;
    return Math.min(from + 2 * Math.floor((b - from) / 2), lastBar);
  };
  const ps = pairStart(Math.max(bar, sel.loop ? sel.loop[0] : 1));
  const { cur, next, loopBars } = useMemo(() => {
    const end = sel.loop ? sel.loop[1] : lastBar;
    const cur = [ps, ps + 1].filter((n) => n <= end);
    const after = cur[cur.length - 1] + 1;
    const nextStart = after > end ? (sel.loop ? sel.loop[0] : 1) : after;
    const next = [nextStart, nextStart + 1].filter((n) => n <= end);
    const loopBars = sel.loop ? Array.from({ length: sel.loop[1] - sel.loop[0] + 1 }, (_, i) => sel.loop![0] + i) : [];
    return { cur, next, loopBars };
  }, [ps, sel, lastBar]);

  const svgs = useMemo(() => {
    void size;
    if (sel.big) {
      const rows: string[] = [];
      for (let b0 = 0; b0 < sel.big.length; b0 += 2) {
        const part = sel.big.slice(b0, b0 + 2);
        const labels = part.map((_, i) => (sel.big!.length > 1 ? `${b0 + i + 1}.` : ''));
        rows.push(rowSVG(part, labels, 560 * part.length));
      }
      const strip = rowSVG(loopBars.map((n) => song.score[n]), loopBars, 420 * Math.max(2, loopBars.length), marks);
      return { main: rows, strip, next: '' };
    }
    const vw = fitWidth(lineBox.current, 2);
    return {
      main: [rowSVG(cur.map((n) => song.score[n]), cur, (vw * cur.length) / 2, marks)],
      next: rowSVG(next.map((n) => song.score[n]), next, (vw * next.length) / 2, marks),
      strip: '',
    };
    // a cur/next tartalmát a ps (ütempár eleje) határozza meg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, ps, size, song, marks]);

  // lejátszófej: képkockánként, közvetlenül az SVG-ben (React újrarajzolás nélkül)
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (engine.tick()) setPlaying(false);
      const tm = engine.timing, t = engine.time(), b = tm.barAt(t), frac = t < song.offset ? 0 : tm.barPos(t) - b;
      setBar((old) => (old === b ? old : b));
      const on = engine.playing;
      if (sel.big) {
        const inLoop = !!sel.loop && b >= sel.loop[0] && b <= sel.loop[1];
        const idx = inLoop ? sel.big.indexOf(song.score[b] as Beats) : -1;
        bigBox.current?.querySelectorAll('svg').forEach((svg, r) => setPlayhead(svg, on ? idx - r * 2 : -1, frac, true));
        setPlayhead(lineBox.current?.querySelector('svg') ?? null, on ? loopBars.indexOf(b) : -1, frac);
      } else {
        setPlayhead(lineBox.current?.querySelector('svg') ?? null, on ? cur.indexOf(b) : -1, frac);
      }
      const p = document.getElementById('song-progress');
      if (p) p.style.width = `${(t / engine.duration) * 100}%`;
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [engine, sel, svgs, song, cur, loopBars]);

  const base = pathname.startsWith('/dev/') ? '/dev/dal' : '/dal';
  const go = (key: string) => nav(`${base}/${song.id}/${key}`, { replace: true, state });
  const setM = (k: keyof Mix, v: number) => setMix((m) => ({ ...m, [k]: v }));
  const list = tab === 'song'
    ? [{ key: 'all', label: 'Teljes szám', sub: `1–${lastBar}`, cls: '' }, ...song.sections.flatMap((s, i) => (s.tacet ? [] : [{ key: `s${i}`, label: s.name, sub: `${s.from}–${s.to}`, cls: '' }]))]
    : song.elements.flatMap((e, i) =>
        e.type !== tab ? [] : [
          { key: `e${i}`, label: e.name, sub: `${e.loop[0]}–${e.loop[1]}`, cls: '' },
          ...e.variants.map((v, j) => ({ key: `e${i}v${j + 1}`, label: `↳ ${v.name}`, sub: `${v.loop[0]}–${v.loop[1]}`, cls: 'var' })),
        ]);

  const seekTo = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!engine || sel.loop) return;
    const r = ev.currentTarget.getBoundingClientRect();
    engine.seek(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * engine.duration);
  };

  return (
    <>
      <TopBar title={song.title} backTo={back} backLabel="Vissza">
        {song.artist && <p className="top-sub">{song.artist}</p>}
        <nav className="tabs">
          {TABS.map(([t, label]) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>
      </TopBar>
      <main className="page song-page">
        <nav className="pick">
          {list.length ? (
            list.map((it) => (
              <button key={it.key} className={`${it.cls}${it.key === sel.key ? ' on' : ''}`} onClick={() => go(it.key)}>
                <span>{it.label}</span>
                <small>{it.sub}</small>
              </button>
            ))
          ) : (
            <p className="muted">Ebben a dalban nincs ilyen elem.</p>
          )}
        </nav>

        <section className="score-card">
          <div className="score-head">
            <div>
              <h2 className={sel.isFill ? 'is-fill' : ''}>{sel.name}</h2>
              <p>{sel.sub}</p>
            </div>
            <div className="barnum">
              <small>ütem</small>
              <b>{bar}</b>
              <span>/ {lastBar}</span>
            </div>
          </div>
          {sel.big ? (
            <>
              <div className="score-big" ref={bigBox} dangerouslySetInnerHTML={{ __html: svgs.main.join('') }} />
              <div className="score-strip" ref={lineBox} dangerouslySetInnerHTML={{ __html: svgs.strip }} />
            </>
          ) : (
            <div className="score-line" ref={lineBox}>
              <div className="score-now" dangerouslySetInnerHTML={{ __html: svgs.main[0] }} />
              <div className="score-next" dangerouslySetInnerHTML={{ __html: svgs.next }} />
            </div>
          )}
          {!sel.loop && (
            <div className="song-progress" onPointerDown={seekTo}>
              <div id="song-progress" />
            </div>
          )}
        </section>

        <section className="transport">
          <button className="play-btn" onClick={toggle} disabled={!engine} aria-label={playing ? 'Megállítás' : 'Lejátszás'}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
            )}
          </button>
          <div className="transport-info">
            {err ? <span className="error-text">A hangsávok nem töltődtek be: {err}</span> : !engine ? <span>Hangsávok betöltése…</span> : <span>{sel.loop ? 'Loop: ' + sel.loop[0] + '–' + sel.loop[1] + '. ütem' : 'Az egész dal, elejétől végéig'}</span>}
          </div>
        </section>

        <section className="mixer-card">
          <Slider label="Tempó" value={mix.tempo} min={50} max={100} unit="%" onChange={(v) => setM('tempo', v)}>
            <div className="quick">
              {[50, 75, 90, 100].map((p) => (
                <button key={p} className={mix.tempo === p ? 'on' : ''} onClick={() => setM('tempo', p)}>
                  {p}%
                </button>
              ))}
            </div>
          </Slider>
          <Slider label="Band" value={mix.band} onChange={(v) => setM('band', v)} />
          <Slider label="Dob" value={mix.drums} onChange={(v) => setM('drums', v)} />
          <Slider label="Metronóm" value={mix.metro} onChange={(v) => setM('metro', v)} />
        </section>

        <Link className="btn ghost back-link" to={back}>
          ← Vissza
        </Link>
      </main>
    </>
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
