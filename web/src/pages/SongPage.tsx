import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { BackIcon, PencilIcon } from '../components/Icons';
import { SongMixer } from '../components/SongMixer';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';
import { SongEngine } from '../songs/engine';
import { findSong, loadSongData, useSongs } from '../songs/store';
import { fitWidth, marksOf, rowSVG, setPlayhead } from '../songs/notation';
import type { Beats, ElementPart, SongData } from '../songs/types';

/* Egy dal gyakorlása (a diák nézete, telefonra tervezve), a Song Practice motorjával.
   Fent végig a dal címe, alatta a szűrősáv: Minden · Groove-ok · Fillek · Teljes szám.
   Minden: három ikonos kártya. Groove-ok / Fillek: lenyíló lista; a kinyitott elem helyben gyakorolható (kotta, ismétlés,
   lejátszás, keverő), a többi csukva marad. Teljes szám: mindig csak az épp szóló ütem; idővonal, „Szerkezet” lista.
   URL: /dal/<id> (Minden) · /dal/<id>/grooves | fills (lista, semmi sincs nyitva) · e3 / e3v1 (az az elem nyitva)
   · all (teljes szám) · s2 (a 2. szekció ismételve). */

type View = 'all' | 'groove' | 'fill' | 'song';
type I18nFns = Pick<ReturnType<typeof useI18n>, 'pick' | 'text'>;
/** a lejátszó képkockánként hívja: az aktuális ütem, hol tart benne, szól-e */
type FrameFn = (bar: number, frac: number, on: boolean, t: number) => void;

interface Route {
  view: View;
  /** a nyitott elem kulcsa (e3, e3v1) */
  open: string | null;
  /** teljes szám: az ismételt szekció */
  sec: number | null;
}

function routeOf(song: SongData, key: string): Route {
  const m = /^e(\d+)(?:v(\d+))?$/.exec(key), s = /^s(\d+)$/.exec(key);
  if (m && song.elements[+m[1]] && (!m[2] || song.elements[+m[1]].variants[+m[2] - 1])) return { view: song.elements[+m[1]].type, open: key, sec: null };
  if (key === 'grooves') return { view: 'groove', open: null, sec: null };
  if (key === 'fills') return { view: 'fill', open: null, sec: null };
  if (s && song.sections[+s[1]]) return { view: 'song', open: null, sec: +s[1] };
  if (key === 'all') return { view: 'song', open: null, sec: null };
  return { view: 'all', open: null, sec: null };
}

/** egy szűrő első kulcsa: a listában az első elem nyitva */
function firstKey(song: SongData, view: View) {
  if (view === 'all') return '';
  if (view === 'song') return 'all';
  const i = song.elements.findIndex((e) => e.type === view);
  return i >= 0 ? `e${i}` : null;
}

/** a szekciósáv színe a szekció neve szerint (az azonos részek egyforma színűek) */
function secColor(name: string) {
  const n = name.toLowerCase();
  if (/verse|vers/.test(n)) return '#70f8ba';
  if (/chorus|refr/.test(n)) return '#f0dcca';
  if (/pre/.test(n)) return '#9fd3c7';
  if (/bridge|híd|instru|solo|szóló/.test(n)) return '#426b69';
  return '#d9d2dc';
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function SongPage() {
  const { pick } = useI18n();
  const { id, sel: selKey = '' } = useParams();
  const songs = useSongs();
  const row = findSong(songs, id);
  const [song, setSong] = useState<SongData | null>(null);
  const [err, setErr] = useState('');
  // a szerkesztés után (új updated_at) a lejátszó a friss szerkezetet kapja
  useEffect(() => {
    if (!row?.structure) return;
    let alive = true;
    loadSongData(row)
      .then((s) => alive && setSong(s))
      .catch((e) => alive && setErr(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [row?.id, row?.updated_at]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!song || song.id !== id) {
    const missing = songs && (!row || !row.structure);
    return (
      <>
        <TopBar title={row?.title || pick('Dal', 'Song')} backTo="/" />
        <main className="page">
          <p className="muted">{err || (missing ? pick('Ez a dal nincs a BEATHUBban.', 'This song is not in BEATHUB.') : pick('Betöltés…', 'Loading…'))}</p>
        </main>
      </>
    );
  }
  return <SongView key={song.id} song={song} selKey={selKey} />;
}

/* ---------------------------------------------------------------- a dal: egy motor, négy nézet */

function SongView({ song, selKey }: { song: SongData; selKey: string }) {
  const { pick, text } = useI18n();
  const nav = useNavigate();
  const { pathname, state } = useLocation() as { pathname: string; state: { back?: string } | null };
  const route = useMemo(() => routeOf(song, selKey), [song, selKey]);
  const [engine, setEngine] = useState<SongEngine | null>(null);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(1);
  const engRef = useRef<SongEngine | null>(null);
  const frame = useRef<FrameFn | null>(null);

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

  const toggle = useCallback(() => {
    const e = engRef.current;
    if (!e) return;
    if (e.playing) e.pause();
    else e.play();
    setPlaying(e.playing);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' || /INPUT|SELECT|TEXTAREA|BUTTON/.test((ev.target as HTMLElement).tagName)) return;
      if (routeOf(song, selKey).view === 'all') return;
      ev.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, song, selKey]);

  // a kezdőlapon, vagy ha a lista minden eleme csukva, nincs mit szólnia
  useEffect(() => {
    const e = engRef.current;
    if (e && (route.view === 'all' || (route.view !== 'song' && !route.open)) && e.playing) {
      e.pause();
      setPlaying(false);
    }
  }, [route, engine]);

  // képkockánként: hol tart a dal; a nyitott nézet a kottáján mutatja
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const f = () => {
      raf = requestAnimationFrame(f);
      if (engine.tick()) setPlaying(false);
      const tm = engine.timing, t = engine.time(), b = tm.barAt(t), frac = t < song.offset ? 0 : tm.barPos(t) - b;
      setBar((old) => (old === b ? old : b));
      frame.current?.(b, frac, engine.playing, t);
    };
    f();
    return () => cancelAnimationFrame(raf);
  }, [engine, song]);

  const base = pathname.startsWith('/dev/') ? '/dev/dal' : '/dal';
  const go = useCallback((key: string) => nav(`${base}/${song.id}${key ? `/${key}` : ''}`, { replace: true, state }), [nav, base, song.id, state]);
  const player = { engine, err, playing, toggle, bar, frame, go };

  return (
    <div className="sp-shell">
      <SongHeader song={song} view={route.view} base={base} />
      {route.view === 'all' && <SongHome song={song} go={go} />}
      {(route.view === 'groove' || route.view === 'fill') && <ElementList song={song} type={route.view} open={route.open} {...player} i18n={{ pick, text }} />}
      {route.view === 'song' && <FullSong song={song} sec={route.sec} {...player} />}
    </div>
  );
}

interface Player {
  engine: SongEngine | null;
  err: string;
  playing: boolean;
  toggle: () => void;
  bar: number;
  frame: MutableRefObject<FrameFn | null>;
  go: (key: string) => void;
}

/** a dal fejléce: vissza, cím, előadó, tanárnak Szerkesztés; alatta a szűrősáv. Görgetéskor fent marad. */
function SongHeader({ song, view, base }: { song: SongData; view: View; base: string }) {
  const { t, pick } = useI18n();
  const { pathname, state } = useLocation() as { pathname: string; state: { back?: string } | null };
  const { profile } = useAuth();
  const back = state?.back ?? (profile?.role === 'teacher' ? '/tananyag/dalok' : '/');
  const tabs: [View, string][] = [['all', pick('Minden', 'All')], ['groove', pick('Groove-ok', 'Grooves')], ['fill', pick('Fillek', 'Fills')], ['song', pick('Teljes szám', 'Full song')]];
  const meta = [song.artist, song.bpm ? `${Math.round(song.bpm)} BPM` : ''].filter(Boolean).join(' · ');
  return (
    <header className="sp-top">
      <div className="sp-top-row">
        <Link className="sp-back" to={back} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className="sp-title">
          <h1>{song.title}</h1>
          {meta && <small>{meta}</small>}
        </div>
        {profile?.role === 'teacher' && (
          <Link className="sp-edit" to={`/tananyag/dalok/${encodeURIComponent(song.id)}/szerkesztes`} state={{ back: pathname }} aria-label={pick('Szerkesztés', 'Edit')} title={pick('Szerkesztés', 'Edit')}>
            <PencilIcon size={20} />
          </Link>
        )}
      </div>
      <nav className="sp-filter" aria-label={pick('Mit gyakorolsz', 'What to practise')}>
        {tabs.map(([id, label]) => {
          const k = firstKey(song, id);
          return k === null ? null : (
            <Link key={id} className={`f-${id}${id === view ? ' on' : ''}`} aria-current={id === view ? 'page' : undefined} to={`${base}/${song.id}${k ? `/${k}` : ''}`} replace state={state}>
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/* ---------------------------------------------------------------- Minden: mit gyakorolsz? */

const GrooveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="8" rx="8" ry="3" />
    <path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />
    <path d="M4 12l4 1.6M20 12l-4 1.6M12 11v8" />
  </svg>
);
const FillIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 21l10-13" />
    <path d="M21 21L11 8" />
    <circle cx="13.5" cy="7.3" r="1.4" />
    <circle cx="10.5" cy="7.3" r="1.4" />
    <path d="M8 3.5l1 1.6M12 2v2M16 3.5l-1 1.6" />
  </svg>
);
const SongIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 18h18" />
    <path d="M4 14v-4M7 14V7M10 14v-6M13 14V5M16 14V9M19 14v-3" />
    <circle cx="9" cy="18" r="1.6" fill="currentColor" />
  </svg>
);
const Chevron = () => (
  <svg className="sp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function SongHome({ song, go }: { song: SongData; go: (key: string) => void }) {
  const { pick } = useI18n();
  const grooves = song.elements.filter((e) => e.type === 'groove').length, fills = song.elements.filter((e) => e.type === 'fill').length;
  const cards: { view: View; title: string; count: string; sub: string; icon: JSX.Element }[] = [
    { view: 'groove', title: pick('Groove-ok', 'Grooves'), count: pick(`${grooves} groove`, `${grooves} grooves`), sub: pick('Egyenként, a dal saját hangjával ismételve', 'One by one, looped with the song audio'), icon: <GrooveIcon /> },
    { view: 'fill', title: pick('Fillek', 'Fills'), count: pick(`${fills} fill`, `${fills} fills`), sub: pick('Az előtte lévő ütemmel együtt, körbe', 'With the bar before, looped'), icon: <FillIcon /> },
    { view: 'song', title: pick('Teljes szám', 'Full song'), count: pick(`${song.score.length - 1} ütem · ${song.sections.length} szekció`, `${song.score.length - 1} bars · ${song.sections.length} sections`), sub: pick('Elejétől végéig, vagy egy szekció ismételve', 'Start to finish, or one section looped'), icon: <SongIcon /> },
  ];
  return (
    <main className="page sp-home">
      <p className="sp-ask">{pick('MIT GYAKOROLSZ?', 'WHAT DO YOU PRACTISE?')}</p>
      {cards.map((c) => {
        const k = firstKey(song, c.view);
        return k === null ? null : (
          <button key={c.view} type="button" className={`sp-card ${c.view}`} onClick={() => go(k)}>
            <span className="sp-card-icon">{c.icon}</span>
            <span className="sp-card-text">
              <b>{c.title}</b>
              <small>{c.count}</small>
              <span>{c.sub}</span>
            </span>
            <svg className="sp-card-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        );
      })}
    </main>
  );
}

/* ---------------------------------------------------------------- Groove-ok / Fillek: lenyíló lista */

interface Item {
  key: string;
  part: ElementPart;
  name: string;
  sub: string;
  bars: number;
  variant: boolean;
}

function ElementList({ song, type, open, i18n, ...player }: Player & { song: SongData; type: 'groove' | 'fill'; open: string | null; i18n: I18nFns }) {
  const { pick, text } = i18n;
  const secName = (b: number) => {
    const s = song.sections.find((x) => b >= x.from && b <= x.to);
    return s ? text(s.name) : '';
  };
  const items = useMemo<Item[]>(() => {
    const where = (p: ElementPart, isFill: boolean) => {
      const a = isFill ? p.loop[0] + 1 : p.loop[0], z = p.loop[1];
      return `${secName(a)}${secName(a) ? ' · ' : ''}${a === z ? pick(`${a}. ütem`, `bar ${a}`) : pick(`${a}–${z}. ütem`, `bars ${a}–${z}`)}`;
    };
    return song.elements.flatMap((e, i) =>
      e.type !== type ? [] : [
        { key: `e${i}`, part: e, name: text(e.name), sub: where(e, type === 'fill'), bars: e.bars?.length ?? 1, variant: false },
        ...e.variants.map((v, j) => ({
          key: `e${i}v${j + 1}`, part: v, name: text(v.name), sub: `${text(e.name)} · ${where(v, type === 'fill')}`, bars: v.bars?.length ?? 1, variant: true,
        })),
      ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, type, pick, text]);
  const nG = song.elements.filter((e) => e.type === type).length;

  return (
    <main className={`page sp-list ${type}`}>
      <p className="sp-lead">
        {type === 'fill'
          ? pick(`${nG} fill · koppints egyre: itt helyben nyílik a gyakorlás`, `${nG} fills · tap one to practise it right here`)
          : pick(`${nG} groove · koppints egyre: itt helyben nyílik a gyakorlás`, `${nG} grooves · tap one to practise it right here`)}
      </p>
      {items.map((it) => {
        const isOpen = it.key === open;
        return (
          <section key={it.key} className={`sp-item${it.variant ? ' var' : ''}${isOpen ? ' open' : ''}`}>
            <button type="button" className="sp-item-head" aria-expanded={isOpen} onClick={() => player.go(isOpen ? (type === 'fill' ? 'fills' : 'grooves') : it.key)}>
              <span className="sp-item-name">
                {it.variant && <small>{pick('VARIÁCIÓ', 'VARIATION')}</small>}
                <b>{it.name}</b>
                <span>{it.sub}</span>
              </span>
              <span className="sp-item-tag">{pick(`${it.bars} ÜTEM`, it.bars > 1 ? `${it.bars} BARS` : '1 BAR')}</span>
              <Chevron />
            </button>
            {isOpen && <OpenItem song={song} part={it.part} isFill={type === 'fill'} name={it.name} {...player} />}
          </section>
        );
      })}
      <p className="sp-foot">
        {type === 'fill'
          ? pick('A fill az előtte lévő ütemmel együtt ismétlődik, hogy a beszállást is gyakorold.', 'A fill loops together with the bar before it, so you practise the way in too.')
          : pick('A behúzott, szaggatott szélű dobozok variációk: ugyanaz a groove kis eltéréssel, a dal adott helyén.', 'The indented, dashed boxes are variations: the same groove with a small change, at that spot in the song.')}
      </p>
    </main>
  );
}

/** a kinyitott elem: a kotta (fillnél halványan előtte a beszálló ütem), ismétlés, lejátszás, keverő */
function OpenItem({ song, part, isFill, name, engine, err, playing, toggle, bar, frame }: Player & { song: SongData; part: ElementPart; isFill: boolean; name: string }) {
  const { t, pick } = useI18n();
  const marks = useMemo(() => marksOf(song), [song]);
  const [mixer, setMixer] = useState(false);
  const box = useRef<HTMLDivElement>(null), scoreBox = useRef<HTMLDivElement>(null);
  const loopBars = useMemo(() => range(part.loop[0], part.loop[1]), [part]);

  // kinyitáskor: ezt az ütemtartományt ismétli, az elejéről; és a doboz látótérbe kerül
  useEffect(() => {
    if (!engine) return;
    const tm = engine.timing;
    engine.setLoop(tm.range(part.loop[0], part.loop[1]));
    engine.seek(tm.barStart(part.loop[0]));
  }, [engine, part]);
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [part]);

  // groove: az elem ütemei (2-esével soronként) · fill: a beszálló ütem halványan + a fill ütemei
  const svgs = useMemo(() => {
    if (isFill) {
      const fillBars = loopBars.slice(1);
      return {
        prev: rowSVG([song.score[loopBars[0]]], [''], 420, marks),
        rows: [rowSVG(fillBars.map((n) => song.score[n]), fillBars.map(() => ''), 420 * fillBars.length, marks)],
      };
    }
    const bars = part.bars || [part.beats], rows: string[] = [];
    for (let b0 = 0; b0 < bars.length; b0 += 2) {
      const p = bars.slice(b0, b0 + 2);
      rows.push(rowSVG(p, p.map((_, i) => (bars.length > 1 ? `${b0 + i + 1}.` : '')), 560 * p.length));
    }
    return { prev: '', rows };
  }, [isFill, loopBars, part, song, marks]);

  useEffect(() => {
    const bars = part.bars || [part.beats];
    frame.current = (b, frac, on) => {
      const el = scoreBox.current;
      if (!el) return;
      const li = loopBars.indexOf(b);
      if (isFill) {
        const [pv, ...rest] = Array.from(el.querySelectorAll('svg'));
        setPlayhead(pv ?? null, on && li === 0 ? 0 : -1, frac);
        rest.forEach((svg) => setPlayhead(svg, on && li > 0 ? li - 1 : -1, frac, true));
      } else {
        const idx = li >= 0 ? bars.indexOf(song.score[b] as Beats) : -1;
        el.querySelectorAll('svg').forEach((svg, r) => setPlayhead(svg, on ? idx - r * 2 : -1, frac, true));
      }
    };
    return () => {
      frame.current = null;
    };
  }, [frame, loopBars, isFill, part, song, svgs]);

  const rep = Math.max(1, loopBars.indexOf(bar) + 1);
  return (
    <div className="sp-item-body" ref={box}>
      <div className="score-card sp-item-score">
        <div className={`sp-item-notes${isFill ? ' with-prev' : ''}`} ref={scoreBox}>
          {svgs.prev && <div className="sp-prev" dangerouslySetInnerHTML={{ __html: svgs.prev }} />}
          <div className="sp-rows" dangerouslySetInnerHTML={{ __html: svgs.rows.join('') }} />
        </div>
        <small className="sp-score-note">
          {isFill
            ? pick('Halványan az előtte lévő ütem: vele együtt ismétlődik.', 'Faded: the bar before, which loops with it.')
            : pick(`${loopBars.length} ütemes loop a dal saját hangjával`, `${loopBars.length}-bar loop with the song audio`)}
        </small>
      </div>
      <div className="sp-item-ctrl">
        <button type="button" className="sp-play" onClick={toggle} disabled={!engine} aria-label={`${playing ? t.stop : t.play}: ${name}`}>
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
          )}
        </button>
        <div className="sp-rep">
          {err ? (
            <span className="error-text">{pick('A hangsávok nem töltődtek be', 'The audio tracks did not load')}</span>
          ) : !engine ? (
            <span className="sp-loading">{pick('Hangsávok betöltése…', 'Loading audio…')}</span>
          ) : (
            <>
              <small>{pick('ISMÉTLÉS', 'REPEAT')}</small>
              <b>×{rep}</b>
              <span>/ {loopBars.length}</span>
            </>
          )}
        </div>
        <button type="button" className={`sp-mix-btn${mixer ? ' on' : ''}`} aria-expanded={mixer} onClick={() => setMixer((m) => !m)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 4v16M12 4v16M18 4v16" />
            <path d="M3 15h6M9 8h6M15 13h6" />
          </svg>
          {pick('Keverő', 'Mixer')}
        </button>
      </div>
      {/* a keverő akkor is fut (a mentett hangerőket alkalmazza), ha csukva van */}
      <div className="sp-item-mixer" hidden={!mixer}>
        <SongMixer engine={engine} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Teljes szám */

function FullSong({ song, sec, engine, err, playing, toggle, bar, frame, go }: Player & { song: SongData; sec: number | null }) {
  const { t, pick, text } = useI18n();
  const marks = useMemo(() => marksOf(song), [song]);
  const [sheet, setSheet] = useState(false);
  const lineBox = useRef<HTMLDivElement>(null);
  const lastBar = song.score.length - 1;
  const loop = sec !== null ? ([song.sections[sec].from, song.sections[sec].to] as [number, number]) : null;

  // kiválasztás → loop (vagy az egész dal) + ugrás az elejére
  useEffect(() => {
    if (!engine) return;
    const tm = engine.timing;
    engine.setLoop(loop ? tm.range(loop[0], loop[1]) : null);
    engine.seek(loop ? tm.barStart(loop[0]) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, sec]);

  // a kotta mérete a dobozhoz igazodik
  const [size, setSize] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(() => setSize((n) => n + 1));
    if (lineBox.current) ro.observe(lineBox.current);
    return () => ro.disconnect();
  }, []);

  // az ütemek neve (melyik groove / fill szól): a kotta tömbjei azonosak az elemekéivel
  const nameOf = useMemo(() => {
    const m = new Map<Beats, string>();
    song.elements.forEach((e) => {
      (e.bars ?? [e.beats]).forEach((b) => m.set(b, text(e.name)));
      e.variants.forEach((v) => (v.bars ?? [v.beats]).forEach((b) => m.set(b, `${text(e.name)} · ${text(v.name)}`)));
    });
    return (b: Beats | null | undefined) => (b ? m.get(b) ?? (b.every((x) => /^[-\s]+$/.test(x)) ? pick('szünet', 'rest') : '') : '');
  }, [song, text, pick]);

  const secIndexOf = (b: number) => Math.max(0, song.sections.findIndex((s) => b >= s.from && b <= s.to));
  const cur = Math.min(Math.max(bar, loop ? loop[0] : 1), lastBar);

  // az ismétlődő futás (ugyanaz az ütem egymás után, a szekción belül) és ami utána jön
  const run = useMemo(() => {
    const s = song.sections[secIndexOf(cur)];
    const lo = loop ? loop[0] : s?.from ?? 1, hi = loop ? loop[1] : s?.to ?? lastBar;
    let a = cur, z = cur;
    while (a - 1 >= lo && song.score[a - 1] === song.score[cur]) a--;
    while (z + 1 <= hi && song.score[z + 1] === song.score[cur]) z++;
    const nextBar = z + 1 <= (loop ? loop[1] : lastBar) ? z + 1 : loop ? loop[0] : null;
    return { rep: cur - a + 1, of: z - a + 1, nextBar };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, sec, song]);

  const svg = useMemo(() => {
    void size;
    return rowSVG([song.score[cur]], [cur], fitWidth(lineBox.current, 1), marks);
  }, [cur, size, song, marks]);

  useEffect(() => {
    frame.current = (b, frac, on, tt) => {
      setPlayhead(lineBox.current?.querySelector('svg') ?? null, on && b === cur ? 0 : -1, frac);
      const p = document.getElementById('song-playhead');
      if (p && engine) p.style.left = `${(tt / engine.duration) * 100}%`;
    };
    return () => {
      frame.current = null;
    };
  }, [frame, cur, svg, engine]);

  const seekTo = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!engine || loop) return;
    const r = ev.currentTarget.getBoundingClientRect();
    engine.seek(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * engine.duration);
  };
  const jump = (i: number) => {
    setSheet(false);
    if (sec !== null) go(`s${i}`);
    // egy hajszállal az ütem eleje után, hogy már a szekció első üteme számítson aktuálisnak
    else if (engine) engine.seek(engine.timing.barStart(song.sections[i].from) + 0.02);
  };
  const si = sec ?? secIndexOf(cur), section = song.sections[si];
  const total = lastBar || 1;
  const secLeft = section ? ((section.from - 1) / total) * 100 : 0;
  const timeOf = (b: number) => (engine ? fmt(engine.timing.barStart(b)) : '');

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  return (
    <main className="page song-page sp-full">
      {section && (
        <div className="sp-section">
          <span className="sp-sec-chip" style={{ background: secColor(section.name) }}>{text(section.name)}</span>
          <small>{pick(`${section.from}–${section.to}. ütem`, `bars ${section.from}–${section.to}`)}</small>
          <label className="sp-loop">
            <input type="checkbox" checked={sec !== null} onChange={(e) => go(e.target.checked ? `s${si}` : 'all')} />
            {pick('Szekció ismétlése', 'Loop section')}
          </label>
        </div>
      )}

      <section className="score-card">
        <div className="score-head">
          <div>
            <small className="sp-now">{pick('MOST SZÓL', 'NOW PLAYING')}</small>
            <h2>{nameOf(song.score[cur]) || `${cur}. ${pick('ütem', 'bar')}`}</h2>
          </div>
          <div className="barnum">
            <small>{pick('ismétlés', 'repeat')}</small>
            <b>×{run.rep}</b>
            <span>/ {run.of}</span>
          </div>
        </div>
        <div className="score-line single" ref={lineBox} dangerouslySetInnerHTML={{ __html: svg }} />
        {run.nextBar !== null && (
          <div className="sp-next">
            <small>{pick('KÖVETKEZIK', 'NEXT')}</small>
            <span className={marks.fillBars.has(run.nextBar) ? 'fill' : ''}>{nameOf(song.score[run.nextBar]) || `${run.nextBar}.`}</span>
            <small className="sp-next-bar">{pick(`${cur}. ütem / ${lastBar}`, `bar ${cur} / ${lastBar}`)}</small>
          </div>
        )}
      </section>

      <section className="sp-timeline" aria-label={pick('Idővonal', 'Timeline')}>
        <div className="sp-segs" onPointerDown={seekTo}>
          {song.sections.map((s, i) => (
            <span key={i} title={text(s.name)} className={i === si ? 'on' : ''} style={{ flex: `${s.to - s.from + 1} 1 0`, background: secColor(s.name) }} />
          ))}
          <i id="song-playhead" aria-hidden="true" />
        </div>
        <div className="sp-under">
          <div className="sp-seclabel">
            {section && (
              <span style={{ left: `${Math.min(secLeft, 45)}%` }}>
                <i aria-hidden="true" />
                <b>{text(section.name)}</b>
                <small> · {pick(`${section.from}–${section.to}. ütem`, `bars ${section.from}–${section.to}`)} · {timeOf(section.from)}</small>
              </span>
            )}
          </div>
          <button type="button" className="sp-struct-btn" aria-expanded={sheet} onClick={() => setSheet(true)}>
            {pick('Szerkezet', 'Structure')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
        </div>
      </section>

      <section className="transport">
        <button className="play-btn" onClick={toggle} disabled={!engine} aria-label={playing ? t.stop : t.play}>
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
          )}
        </button>
        <div className="transport-info">
          {err ? (
            <span className="error-text">{pick('A hangsávok nem töltődtek be', 'The audio tracks did not load')}: {err}</span>
          ) : !engine ? (
            <span>{pick('Hangsávok betöltése…', 'Loading audio tracks…')}</span>
          ) : (
            <span>
              {loop ? pick(`Loop: ${loop[0]}–${loop[1]}. ütem`, `Loop: bars ${loop[0]}–${loop[1]}`) : pick('Az egész dal', 'The whole song')}
              <small>{pick('a kotta csak akkor vált, ha a groove változik', 'the score only changes when the groove does')}</small>
            </span>
          )}
        </div>
      </section>

      <SongMixer engine={engine} />

      {sheet && (
        <div className="sp-sheet-wrap" onClick={() => setSheet(false)}>
          <section className="sp-sheet" role="dialog" aria-modal="true" aria-label={pick('A dal szerkezete', 'Song structure')} onClick={(e) => e.stopPropagation()}>
            <span className="sp-grip" aria-hidden="true" />
            <div className="sp-sheet-head">
              <div>
                <h2>{pick('A dal szerkezete', 'Song structure')}</h2>
                <p>
                  {pick(
                    `${song.sections.length} szekció · ${lastBar} ütem${engine ? ` · ${fmt(engine.duration)}` : ''} · koppints egyre, oda ugrik`,
                    `${song.sections.length} sections · ${lastBar} bars${engine ? ` · ${fmt(engine.duration)}` : ''} · tap one to jump there`,
                  )}
                </p>
              </div>
              <button type="button" className="sp-close" onClick={() => setSheet(false)} aria-label={pick('Bezárás', 'Close')}>✕</button>
            </div>
            <ol>
              {song.sections.map((s, i) => {
                const now = i === si, done = i < si, len = s.to - s.from + 1;
                return (
                  <li key={i}>
                    <button type="button" className={`${now ? 'now' : ''}${done ? ' done' : ''}`} onClick={() => jump(i)}>
                      <span className="sp-dot" style={{ background: secColor(s.name) }} aria-hidden="true" />
                      <span className="sp-row-text">
                        <b>{text(s.name)}</b>
                        <small>{pick(`${s.from}–${s.to}. ütem · ${len} ütem`, `bars ${s.from}–${s.to} · ${len} bars`)}{engine ? ` · ${timeOf(s.from)}` : ''}</small>
                        {now && (
                          <span className="sp-prog" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, ((cur - s.from + 1) / len) * 100)}%` }} />
                          </span>
                        )}
                      </span>
                      {now && <span className="sp-now-badge">{pick('MOST', 'NOW')}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}
