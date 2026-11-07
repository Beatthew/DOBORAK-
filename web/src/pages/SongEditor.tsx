import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SongMixer } from '../components/SongMixer';
import { TopBar } from '../components/TopBar';
import { songPath } from '../data/catalog';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { EditorModel, INST, LENS, SUBDIV, keyOf, parseBeat, partOf, type Tab } from '../songs/editorModel';
import { SongEngine } from '../songs/engine';
import { rowSVG } from '../songs/notation';
import { findSong, loadSongData, patchSong, useSongs, type SongRow } from '../songs/store';
import { applyRegrid, irregularBars } from '../songs/structure';
import type { Beats } from '../songs/types';

/* A dal szerkesztője: a Song Practice SZERKESZTÉS nézete a BEATHUBban. Bal oldalt a lejátszó és a szekciók,
   jobbra a kotta (GROOVE / FILLS / SONG) és a mintaszerkesztő; alatta a keverő. Minden változtatás magától mentődik
   (a songs.structure-be), és a közzétett dalt a diákok azonnal az újjal kapják. A logika: songs/editorModel.ts. */

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** egy ütem kottája (kézrenddel), a dal ütemszámával; a fill ütem homokszínű alapot kap */
function barSvg(beats: string[] | null, hands: string[] | null, label: number | string, isFill: boolean, w = 500) {
  const b: Beats | null = beats ? Object.assign([...beats], hands ? { hands } : {}) : null;
  const n = typeof label === 'number' ? label : 0;
  return rowSVG([b], [label], w, { fillBars: new Set(isFill ? [n] : []), rideBars: new Set() });
}

export function SongEditor() {
  const { pick } = useI18n();
  const { id = '' } = useParams();
  const songs = useSongs();
  const row = findSong(songs, id);
  if (!row || !row.structure) {
    return (
      <>
        <TopBar title={pick('Szerkesztés', 'Edit')} backTo="/tananyag/dalok" backLabel={pick('Dalok', 'Songs')} />
        <main className="page">
          <p className="muted">{!songs ? pick('Betöltés…', 'Loading…') : row ? pick('Ez a dal még feldolgozás alatt van.', 'This song is still being processed.') : pick('Ez a dal nem található.', 'This song does not exist.')}</p>
        </main>
      </>
    );
  }
  return <Editor key={row.id} row={row} />;
}

function Editor({ row }: { row: SongRow }) {
  const { pick } = useI18n();
  const nav = useNavigate();
  const { state } = useLocation() as { state: { back?: string } | null };
  const back = state?.back ?? '/tananyag/dalok';
  const model = useMemo(() => new EditorModel(row.structure!), [row.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [engine, setEngine] = useState<SongEngine | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(0);
  const [msg, setMsg] = useState<{ text: string; err?: boolean }>({ text: '' });
  const [published, setPublished] = useState(row.published);
  const engRef = useRef<SongEngine | null>(null);
  const saveTimer = useRef(0);
  const title = row.title || row.id;

  // a lejátszó a dal sávjaival; a tempó újraszámolása után újratölt (más az ütemrács)
  const [gridKey, setGridKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setEngine(null);
    loadSongData({ ...row, structure: model.S })
      .then((s) => SongEngine.load(s))
      .then((e) => {
        if (!alive) return e.close();
        engRef.current = e;
        setEngine(e);
      })
      .catch((e) => alive && setLoadErr(String(e.message || e)));
    return () => {
      alive = false;
      engRef.current?.close();
      engRef.current = null;
      setPlaying(false);
    };
  }, [gridKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- mentés (automatikus, a MENTÉS most kényszeríti) ---------- */
  const saveNow = useCallback(async () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    if (!supabase) return false;
    const { structure, error } = model.toStructure();
    if (error) {
      setMsg({ text: error, err: true });
      return false;
    }
    const { data, error: dbErr } = await supabase.from('songs').update({ structure }).eq('id', row.id).select('updated_at').single();
    if (dbErr) {
      setMsg({ text: dbErr.message, err: true });
      return false;
    }
    model.S = structure;
    patchSong({ id: row.id, structure, updated_at: (data as { updated_at: string }).updated_at });
    setMsg({ text: pick('mentve', 'saved') });
    return true;
  }, [model, row.id, pick]);
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    setMsg({ text: pick('mentés…', 'saving…') });
    saveTimer.current = window.setTimeout(() => void saveNow(), 600);
  }, [saveNow, pick]);
  // kilépéskor a függő mentés nem vész el
  useEffect(() => () => {
    if (saveTimer.current) void saveNow();
  }, [saveNow]);

  /** egy szerkesztés: a modell változik, lépés a visszavonáshoz, mentés, újrarajzolás */
  const commit = useCallback((fn: () => void) => {
    fn();
    model.remember();
    scheduleSave();
    bump();
  }, [model, scheduleSave, bump]);

  /* ---------- lejátszás ---------- */
  const toggle = useCallback(() => {
    const e = engRef.current;
    if (!e) return;
    if (e.playing) e.pause();
    else e.play();
    setPlaying(e.playing);
  }, []);
  const seekBar = (n: number) => {
    engine?.seek(model.barStart(n));
  };

  // képkockánként: a folyamatsáv közvetlenül, az ütem és a mutatott szekció állapotként (ütemenként egyszer)
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (engine.tick()) setPlaying(false);
      const t = engine.time();
      const p = document.getElementById('ed-progress');
      if (p) p.style.width = `${(t / engine.duration) * 100}%`;
      const now = document.getElementById('ed-time');
      if (now) now.textContent = fmt(t);
      setBar((old) => {
        const b = model.barAt(t);
        return old === b ? old : b;
      });
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [engine, model]);

  // a kotta a lejátszott szekciót követi (az 1. ütem előtt: az elsőt)
  useEffect(() => {
    const ai = model.blockAtBar(Math.max(bar, 1));
    if (ai >= 0 && ai !== model.shownBlock) {
      model.showBlock(ai);
      bump();
    }
  }, [bar, model, bump]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (ev.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(tag)) {
        ev.preventDefault();
        toggle();
        return;
      }
      if (!(ev.ctrlKey || ev.metaKey) || tag === 'INPUT') return;
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) {
        ev.preventDefault();
        if (model.canUndo()) { model.undo(); scheduleSave(); bump(); }
      } else if (k === 'y' || (k === 'z' && ev.shiftKey)) {
        ev.preventDefault();
        if (model.canRedo()) { model.redo(); scheduleSave(); bump(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, model, scheduleSave, bump]);

  /* ---------- TEMPÓ ÚJRA: előbb ment, megmutatja, mi változna, és csak jóváhagyás után építi újra az ütemrácsot ---------- */
  const regrid = async () => {
    if (!supabase || !(await saveNow())) return;
    const a = model.S, b = applyRegrid(a);
    const ia = irregularBars(a.downbeats).length, ib = irregularBars(b.downbeats).length;
    if (a.bpm === b.bpm && a.bars === b.bars && !ia) return setMsg({ text: pick('A tempó rendben van, nincs mit javítani.', 'The tempo is fine, nothing to fix.') });
    if (!confirm(pick(
      `Tempó újraszámolása:\n\n${a.bpm} → ${b.bpm} BPM\n${a.bars} → ${b.bars} ütem\ngyanús ütem: ${ia} → ${ib}\n\nA szekciók és a beírt kotta idő szerint átkerülnek az új ütemekre. A VISSZA gombbal nem vonható vissza.`,
      `Recalculate tempo:\n\n${a.bpm} → ${b.bpm} BPM\n${a.bars} → ${b.bars} bars\nsuspicious bars: ${ia} → ${ib}\n\nSections and notation move to the new bars by time. Undo cannot reverse this.`,
    ))) return;
    const { error } = await supabase.from('songs').update({ structure: b }).eq('id', row.id);
    if (error) return setMsg({ text: error.message, err: true });
    patchSong({ id: row.id, structure: b });
    model.load(b);
    setGridKey((k) => k + 1);
    setMsg({ text: pick(`tempó újraszámolva: ${b.bpm} BPM, ${b.bars} ütem`, `tempo recalculated: ${b.bpm} BPM, ${b.bars} bars`) });
    bump();
  };

  const togglePublish = async () => {
    if (!supabase) return;
    const next = !published;
    const { error } = await supabase.from('songs').update({ published: next }).eq('id', row.id);
    if (error) return setMsg({ text: error.message, err: true });
    setPublished(next);
    patchSong({ id: row.id, published: next });
  };

  /* Tananyagba: a minta önálló tananyag lesz (groove → Groove-ok, fill → Fillek), a dalból kivágott hangjával:
     a gyakorló részlete (amit a diák is ismétel) a két sávból WAV-ként a „clips” tárhelyre kerül. */
  const toLibrary = async (k: string) => {
    if (!supabase) return;
    const p = model.patterns[k], r = model.practiceRange(k), name = model.pname(k);
    if (!p) return;
    if (!r) return setMsg({ text: pick('Ez a minta még egy ütemben sem szól: előbb tedd be a dalba (SONG fül), hogy legyen hozzá hang.', 'This pattern is not in any bar yet: place it in the song first (SONG tab) so it has audio.'), err: true });
    if (!engine) return setMsg({ text: pick('A sávok még töltődnek.', 'The tracks are still loading.'), err: true });
    const cat = p.type === 'fill' ? 'fillek' : 'grooveok';
    if (!confirm(pick(
      `„${name}” a ${p.type === 'fill' ? 'Fillek' : 'Groove-ok'} közé kerül tananyagként, a dal ${r.from}–${r.to}. ütemének hangjával. Mehet?`,
      `"${name}" goes to ${p.type === 'fill' ? 'Fills' : 'Grooves'} in the library, with the audio of bars ${r.from}–${r.to}. Go ahead?`,
    ))) return;
    if (!(await saveNow())) return;
    setMsg({ text: pick('hang kivágása és feltöltése…', 'cutting and uploading audio…') });
    const [t0, t1] = engine.timing.range(r.from, r.to);
    const audio = engine.exportRange(t0, t1), id = crypto.randomUUID();
    for (const [ch, blob] of Object.entries(audio)) {
      const { error } = await supabase.storage.from('clips').upload(`${id}/${ch.toLowerCase()}.wav`, blob, { contentType: 'audio/wav', upsert: true });
      if (error) return setMsg({ text: `${pick('Feltöltési hiba', 'Upload failed')}: ${error.message}`, err: true });
    }
    const bars = Array.from({ length: model.plen(k) }, (_, i) => {
      const h = p.hands?.slice(i * 4, i * 4 + 4);
      return { beats: p.beats.slice(i * 4, i * 4 + 4), ...(h && h.some((x) => /[RL]/.test(x)) ? { hands: h } : {}) };
    });
    const { error } = await supabase.from('library_items').insert({
      id, category: cat, title: name, subtitle: title, bpm: model.S.bpm, bars, note: '',
      clip: { path: id, song: row.id, from: r.from, to: r.to, duration: Math.round((t1 - t0) * 1000) / 1000, score: r.score },
    });
    if (error) return setMsg({ text: error.message, err: true });
    setMsg({ text: pick(`Bekerült a tananyagba: ${name} (${p.type === 'fill' ? 'Fillek' : 'Groove-ok'}, ${r.from}–${r.to}. ütem hangjával)`, `Added to the library: ${name} (${p.type === 'fill' ? 'Fills' : 'Grooves'}, with bars ${r.from}–${r.to})`) });
  };

  const practice = async () => {
    await saveNow();
    nav(songPath(row.id), { state: { back: `/tananyag/dalok/${encodeURIComponent(row.id)}/szerkesztes` } });
  };

  const S = model.S;
  const sp = model.spans();
  const total = model.totalBars();
  const irregular = useMemo(() => irregularBars(S.downbeats).length, [S]);
  const shown = model.blocks[model.shownBlock];
  const shownSpan = sp[model.shownBlock];
  const shownBar = shownSpan ? bar - shownSpan.from : -1;

  return (
    <>
      <TopBar title={title} backTo={back} backLabel={pick('Dalok', 'Songs')}>
        {row.artist && <p className="top-sub">{row.artist}</p>}
      </TopBar>
      <main className="page song-editor">
        <section className="ed-player">
          <button className="play-btn" onClick={toggle} disabled={!engine} aria-label={playing ? pick('Szünet', 'Pause') : pick('Lejátszás', 'Play')}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
            )}
          </button>
          <div className="ed-player-main">
            <div
              className="song-progress"
              onPointerDown={(ev) => {
                if (!engine) return;
                const el = ev.currentTarget;
                const seek = (x: number) => {
                  const r = el.getBoundingClientRect();
                  engine.seek(Math.min(1, Math.max(0, (x - r.left) / r.width)) * engine.duration);
                };
                el.setPointerCapture(ev.pointerId);
                seek(ev.clientX);
                el.onpointermove = (e) => seek(e.clientX);
                el.onpointerup = () => (el.onpointermove = null);
              }}
            >
              <div id="ed-progress" />
            </div>
            <div className="ed-times">
              <span id="ed-time">0:00</span>
              <span>{loadErr ? <span className="error-text">{loadErr}</span> : engine ? fmt(engine.duration) : pick('Sávok betöltése…', 'Loading tracks…')}</span>
            </div>
          </div>
        </section>

        <Sections model={model} bar={bar} commit={commit} onJump={seekBar} meta={
          <>
            {S.bpm} BPM · {pick('ütem', 'bar')} <b>{Math.max(bar, 1)}</b> / {S.bars}
            {total !== S.bars && <> · {pick('lista', 'list')}: <em>{total}</em></>}
            {irregular > 0 && <> · <em title={pick('Ezekben az ütemekben a klikk rohan vagy lassul: TEMPÓ ÚJRA', 'The click races or drags in these bars: RECALCULATE TEMPO')}>⚠ {irregular} {pick('gyanús ütem', 'suspicious bars')}</em></>}
          </>
        } footer={
          <>
            <button className="btn small" onClick={() => {
              const at = model.splitBlock(model.barAt(engine?.time() ?? 0));
              if (at < 0) return setMsg({ text: pick('ez a szekció túl rövid a kettéosztáshoz', 'this section is too short to split'), err: true });
              commit(() => {});
              setTimeout(() => (document.querySelector(`.ed-row[data-i="${at}"] .n`) as HTMLInputElement | null)?.select(), 0);
            }} title={pick('A szekció, amiben épp vagy, kettéválik az aktuális ütemnél — az ütemek kottája a helyén marad', 'The section you are in splits at the current bar; the notation stays in place')}>
              + {pick('SZEKCIÓ', 'SECTION')}
            </button>
            <button className="btn small" disabled={!model.canUndo()} onClick={() => { model.undo(); scheduleSave(); bump(); }} title="Ctrl+Z">↶ {pick('VISSZA', 'UNDO')}</button>
            <button className="btn small" disabled={!model.canRedo()} onClick={() => { model.redo(); scheduleSave(); bump(); }} title="Ctrl+Y">↷</button>
            <button className="btn small" disabled={!model.canUndo()} onClick={() => {
              if (confirm(pick('Minden változtatást visszavonsz, amit a dal megnyitása óta csináltál?', 'Undo every change since you opened the song?'))) { model.reset(); scheduleSave(); bump(); }
            }}>{pick('ALAPHELYZET', 'RESET')}</button>
            <button className="btn small" onClick={() => void regrid()} title={pick('Ahol az ütemfelismerés félreütemezett (fél / háromnegyed ütemek, rohanó klikk), egyenletes ütemrácsot épít; a szekciók és a kotta idő szerint átkerülnek', 'Builds a steady bar grid where detection misplaced bars; sections and notation move by time')}>
              {pick('TEMPÓ ÚJRA', 'RECALC TEMPO')}
            </button>
          </>
        } />

        <section className="ed-sheet">
          <div className="score-head">
            <div>
              <h2>{shown?.name}</h2>
              <p>{shown && shownSpan ? `${shown.len} ${pick('ütem', 'bars')} · ${shownSpan.from}–${shownSpan.to}${shown.tacet ? ' · tacet' : ''}` : ''}</p>
            </div>
            <div className="barnum">
              <small>{pick('ütem', 'bar')}</small>
              <b>{Math.max(bar, 1)}</b>
            </div>
          </div>
          <nav className="ed-tabs">
            {(['groove', 'fill', 'song'] as Tab[]).map((t) => (
              <button key={t} className={model.tab === t ? 'on' : ''} onClick={() => { model.setTab(t, Math.max(0, shownBar)); bump(); }}>
                {t === 'groove' ? 'GROOVE' : t === 'fill' ? 'FILLS' : 'SONG'}
              </button>
            ))}
          </nav>
          {model.tab === 'song' ? (
            <Strip model={model} shownBar={shownBar} commit={commit} onPick={(j) => {
              model.selBar = j;
              engine?.pause();
              setPlaying(false);
              if (shownSpan) seekBar(shownSpan.from + j);
              bump();
            }} onCut={(text) => setMsg({ text, err: true })} />
          ) : (
            <Chips model={model} commit={commit} bump={bump} />
          )}
          <PatternEditor model={model} commit={commit} onLibrary={(k) => void toLibrary(k)} />
        </section>

        <SongMixer engine={engine} />

        <div className="ed-actions">
          <span className={`ed-msg${msg.err ? ' err' : ''}`}>{msg.text}</span>
          <button className={`btn pub${published ? ' on' : ''}`} onClick={() => void togglePublish()} aria-pressed={published}>
            {published ? pick('Közzétéve a diákoknak', 'Published to students') : pick('Közzététel a diákoknak', 'Publish to students')}
          </button>
          <button className="btn" onClick={() => void saveNow().then((ok) => ok && setMsg({ text: `${pick('Mentve', 'Saved')} · ${new Date().toLocaleTimeString('hu-HU')}` }))}>
            {pick('MENTÉS', 'SAVE')}
          </button>
          <button className="btn primary" onClick={() => void practice()}>
            {pick('GYAKORLÁS', 'PRACTICE')}
          </button>
        </div>
        <Link className="btn ghost back-link" to={back}>← {pick('Dalok', 'Songs')}</Link>
      </main>
    </>
  );
}

/* ---------------------------------------------------------------- SZEKCIÓK */

interface SectionsProps {
  model: EditorModel;
  bar: number;
  commit: (fn: () => void) => void;
  onJump: (bar: number) => void;
  meta: React.ReactNode;
  footer: React.ReactNode;
}

/* a ⋮⋮ fogantyú (egér, toll és érintés egyformán):
   · húzás egy szekcióra: az lesz a másolata (név, tacet, kotta), a helye és a hossza marad
   · Alt + húzás két sor közé: ott új szekció a forrás nevével és hosszával, az alatta lévő ütemeiből
   · kattintás mozgatás nélkül: a lejátszás a szekcióra ugrik */
function Sections({ model, bar, commit, onJump, meta, footer }: SectionsProps) {
  const { pick } = useI18n();
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: number; x: number; y: number; moved: boolean; alt: boolean } | null>(null);
  const [drop, setDrop] = useState<{ on?: number; before?: number; after?: boolean } | null>(null);
  const sp = model.spans();
  const rows = () => [...(list.current?.querySelectorAll<HTMLElement>('.ed-row') ?? [])];
  const dropIndex = (y: number) => rows().findIndex((r) => {
    const b = r.getBoundingClientRect();
    return y >= b.top && y < b.bottom;
  });
  const insertIndex = (y: number) => {
    const i = rows().findIndex((r) => {
      const b = r.getBoundingClientRect();
      return y < b.top + b.height / 2;
    });
    return i < 0 ? rows().length : i;
  };
  const mark = (e: ReactPointerEvent | null) => {
    const d = drag.current;
    if (!e || !d) return setDrop(null);
    if (d.alt) {
      const at = insertIndex(e.clientY);
      setDrop(at < model.blocks.length ? { before: at } : { after: true });
    } else {
      const to = dropIndex(e.clientY);
      setDrop(to >= 0 && to !== d.from ? { on: to } : null);
    }
  };
  const handle = (i: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { from: i, x: e.clientX, y: e.clientY, moved: false, alt: e.altKey };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      if (!d) return;
      d.alt = d.alt || e.altKey;   // az Alt a húzás közben bármikor lenyomható
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
      d.moved = true;
      document.body.style.cursor = 'copy';
      mark(e);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      drag.current = null;
      setDrop(null);
      document.body.style.cursor = '';
      if (!d) return;
      d.moved = d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 5;
      if (!d.moved) return onJump(sp[i].from);   // sima kattintás = ugrás
      if (d.alt || e.altKey) return commit(() => model.insertCopy(d.from, insertIndex(e.clientY)));
      const to = dropIndex(e.clientY);
      if (to >= 0 && to !== d.from) commit(() => model.copyOnto(d.from, to));
    },
    onPointerCancel: () => {
      drag.current = null;
      setDrop(null);
      document.body.style.cursor = '';
    },
  });
  const active = model.blockAtBar(Math.max(bar, 1));

  return (
    <section className="ed-sections">
      <div className="ed-sec-head">
        <h3>{pick('SZEKCIÓK', 'SECTIONS')}</h3>
        <span className="ed-meta">{meta}</span>
      </div>
      <div className="ed-row ed-row-head">
        <span />
        <span>{pick('NÉV', 'NAME')}</span>
        <span>{pick('-TÓL', 'FROM')}</span>
        <span>{pick('-IG', 'TO')}</span>
        <span title={pick('tacet: dob nélkül', 'tacet: no drums')}>T</span>
        <span />
      </div>
      <div className="ed-list" ref={list}>
        {model.blocks.map((b, i) => (
          <div
            key={i}
            data-i={i}
            className={`ed-row${i === active ? ' active' : ''}${drop?.on === i ? ' drop-on' : ''}${drop?.before === i ? ' drop-before' : ''}${drop?.after && i === model.blocks.length - 1 ? ' drop-after' : ''}`}
          >
            <button className="handle" {...handle(i)} title={pick('Kattintás: ugrás ide · Húzás egy szekcióra: az lesz a másolata · Alt + húzás két sor közé: új szekció ott, az alatta lévő ütemeiből', 'Click: jump here · Drag onto a section: it becomes a copy · Alt + drag between rows: insert a copy there')}>
              ⋮⋮
            </button>
            <input className="n" value={b.name} onChange={(e) => commit(() => model.rename(i, e.target.value))} aria-label={pick('Szekció neve', 'Section name')} />
            <NumInput value={sp[i].from} readOnly={i === 0} onCommit={(v) => commit(() => model.setFrom(i, v))} label={pick('-tól', 'from')} />
            <NumInput value={sp[i].to} onCommit={(v) => commit(() => model.setTo(i, v))} label={pick('-ig', 'to')} />
            <input type="checkbox" checked={b.tacet} onChange={(e) => commit(() => model.setTacet(i, e.target.checked))} title={pick('tacet: ebben a szekcióban nincs dob', 'tacet: no drums in this section')} />
            <button className="del" onClick={() => commit(() => model.mergeBlock(i))} title={pick('Összevonás az előző szekcióval (az ütemek kottája megmarad)', 'Merge with the previous section (notation stays)')} disabled={model.blocks.length < 2}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="ed-sec-foot">{footer}</div>
    </section>
  );
}

/** szám mező, ami csak Enterre / elhagyáskor ír (gépelés közben nem ugrálnak a határok) */
function NumInput({ value, onCommit, readOnly, label }: { value: number; onCommit: (v: number) => void; readOnly?: boolean; label: string }) {
  const [v, setV] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setV(String(value));
  }, [value, focus]);
  const done = () => {
    if (+v !== value && v.trim()) onCommit(+v);
    else setV(String(value));
  };
  return (
    <input
      type="number" min={1} value={v} readOnly={readOnly} aria-label={label}
      onFocus={() => setFocus(true)}
      onBlur={() => { setFocus(false); done(); }}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

/* ---------------------------------------------------------------- GROOVE / FILLS: elemek */

function Chips({ model, commit, bump }: { model: EditorModel; commit: (fn: () => void) => void; bump: () => void }) {
  const { pick } = useI18n();
  const type = model.tab === 'fill' ? 'fill' : 'groove';
  const uses = model.useCount();
  const lenBadge = (k: string) => (model.plen(k) > 1 ? <i>{model.plen(k)}ü</i> : null);
  const chip = (k: string, cls: string) => (
    <button key={k} className={`ed-chip ${cls}${type === 'fill' ? ' fill' : ''}${k === model.selPat ? ' on' : ''}`} title={pick(`${uses[k] || 0} ütemben szerepel`, `used in ${uses[k] || 0} bars`)} onClick={() => { model.selectPattern(k); bump(); }}>
      {model.patterns[k].name}
      {lenBadge(k)}
      <small>{uses[k] || 0}×</small>
    </button>
  );
  return (
    <div className="ed-chips">
      {model.cores(type).flatMap((c) => [chip(c.key, c.inSection ? '' : 'other'), ...c.variants.map((v) => chip(v, 'var'))])}
      <button className="ed-chip add" onClick={() => commit(() => model.newPattern({ name: type === 'fill' ? 'Új fill' : 'Új groove', type, len: 1, beats: ['-', '-', '-', '-'] }))}>
        {type === 'fill' ? pick('+ ÚJ FILL', '+ NEW FILL') : pick('+ ÚJ GROOVE', '+ NEW GROOVE')}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- SONG: a szekció ütemei */

function Strip({ model, shownBar, commit, onPick, onCut }: { model: EditorModel; shownBar: number; commit: (fn: () => void) => void; onPick: (j: number) => void; onCut: (text: string) => void }) {
  const { pick } = useI18n();
  const b = model.blocks[model.shownBlock], sp = model.spans()[model.shownBlock];
  if (!b || !sp) return null;
  const options = (['groove', 'fill'] as const).flatMap((t) =>
    model.cores(t).flatMap((c) => [c.key, ...c.variants]).map((v) => {
      const p = model.patterns[v];
      const label = p.variantOf ? `  ↳ ${model.pname(v)}` : `${t === 'fill' ? 'FILL · ' : ''}${p.name}`;
      return <option key={v} value={v}>{label}{model.plen(v) > 1 ? ` · ${model.plen(v)} ütem` : ''}</option>;
    }));
  return (
    <div className="ed-strip">
      {b.tacet && (
        <div className="ed-tacet">
          <b>TACET</b>
          <span>{pick('a dob nagyrészt kiesik · egy-egy ütembe (pl. beszállás) így is írhatsz', 'the drums mostly sit out · you can still write single bars (e.g. a pickup)')}</span>
        </div>
      )}
      {b.bars.map((r, j) => {
        const L = model.okRef(r) ? model.plen(keyOf(r)) : 1;
        return (
          <div key={j} className={`ed-bar${model.isFillKey(r) ? ' isfill' : ''}${j === model.selBar ? ' sel' : ''}${j === shownBar ? ' now' : ''}${L > 1 ? ` multi${partOf(r) > 1 ? ' cont' : ''}` : ''}`}>
            {L > 1 && <span className="part">{partOf(r)}/{L}</span>}
            <div className="ed-bar-svg" onClick={() => onPick(j)} dangerouslySetInnerHTML={{ __html: barSvg(model.partBeats(r), model.partHands(r), sp.from + j, model.isFillKey(r)) }} />
            <select
              value={keyOf(r) ?? ''}
              aria-label={pick(`${sp.from + j}. ütem mintája`, `pattern of bar ${sp.from + j}`)}
              onChange={(e) => commit(() => {
                const k = e.target.value || null;
                const n = model.placeAt(j, k);
                if (k && n < model.plen(k)) onCut(pick(`„${model.pname(k)}” ${model.plen(k)} ütemes — a szekció végén levágva (${n} ütem)`, `"${model.pname(k)}" is ${model.plen(k)} bars — cut at the end of the section (${n} bars)`));
              })}
            >
              <option value="">{pick('— szünet —', '— rest —')}</option>
              {options}
            </select>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- a mintaszerkesztő */

function PatternEditor({ model, commit, onLibrary }: { model: EditorModel; commit: (fn: () => void) => void; onLibrary: (k: string) => void }) {
  const { pick } = useI18n();
  const grid = useRef<HTMLDivElement>(null);
  const noteDrag = useRef<{ cell: HTMLElement; x: number; y: number; moved: boolean } | null>(null);
  const k = model.editKey(), p = k ? model.patterns[k] : undefined;
  if (!k || !p) return null;
  const song = model.tab === 'song', L = model.plen(k);
  const cur = song ? partOf(model.selRef()) : 0;   // a kijelölt ütem a minta hányadik ütemét játssza
  const sp = model.spans()[model.shownBlock];
  const slots = p.beats.map(parseBeat), hands = model.handsOf(p);

  // a minta előnézete: két ütem egy sorban
  const preview: string[] = [];
  for (let b0 = 0; b0 < L; b0 += 2) {
    const n = Math.min(2, L - b0);
    const bars = Array.from({ length: n }, (_, i) => {
      const b = b0 + i, bts = p.beats.slice(b * 4, b * 4 + 4), h = p.hands?.slice(b * 4, b * 4 + 4);
      return Object.assign([...bts], h ? { hands: h } : {}) as Beats;
    });
    preview.push(rowSVG(bars, bars.map((_, i) => (L > 1 ? `${b0 + i + 1}.` : '')), 560 * n));
  }

  /* hangok: kattintás = hang → akcentus → ghost → törlés · egy hangot húzva másik cellára = áthelyezés
     (más hangszer, tag vagy ütem) · a rácson kívülre húzva = törlés */
  const cellAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.ed-grid .cell') ?? null;
  const clearMarks = () => {
    grid.current?.querySelectorAll('.drag-src,.drag-over,.drag-del').forEach((c) => c.classList.remove('drag-src', 'drag-over', 'drag-del'));
    document.body.style.cursor = '';
  };
  const pos = (el: HTMLElement): [number, number, string] => [+el.dataset.beat!, +el.dataset.slot!, el.dataset.ins!];

  return (
    <div className={`ed-pe${p.type === 'fill' ? ' fill' : ''}${p.variantOf ? ' variant' : ''}`}>
      <div className="ed-pe-head">
        {song && (
          <span className="ed-pe-label">
            {sp ? `${sp.from + model.selBar}. ${pick('ütem', 'bar')}` : ''}{L > 1 ? ` (${cur}/${L})` : ''}
            <small>{p.variantOf ? `${model.patterns[p.variantOf]?.name} ·` : model.pname(k)}</small>
          </span>
        )}
        {(!song || p.variantOf) && (
          <input value={p.name} placeholder={song ? pick('variáció neve', 'variation name') : pick('elem neve', 'part name')} onChange={(e) => commit(() => model.renamePattern(e.target.value))} aria-label={pick('Név', 'Name')} />
        )}
        {!song && (
          <span className="ed-lens" title={pick('a minta hossza ütemben', 'pattern length in bars')}>
            {LENS.map((n) => (
              <button key={n} className={n === L ? 'on' : ''} onClick={() => {
                if (n < L && !confirm(pick(`„${model.pname(k)}” ${L} ütemből ${n} ütemes lesz: a ${n + 1}–${L}. ütem kottája törlődik. Mehet?`, `"${model.pname(k)}" goes from ${L} to ${n} bars: bars ${n + 1}–${L} are deleted. Go ahead?`))) return;
                commit(() => model.setLen(k, n));
              }}>{n} {pick('ÜTEM', n === 1 ? 'BAR' : 'BARS')}</button>
            ))}
          </span>
        )}
        {song && p.variantOf && <button className="btn small" onClick={() => commit(() => model.toBase())} title={pick('Ez az ütem újra az alap elemet használja', 'This bar uses the core part again')}>{pick('VISSZA AZ ALAPRA', 'BACK TO CORE')}</button>}
        <button className="btn small" onClick={() => onLibrary(k)} title={pick('Önálló tananyag lesz (Groove-ok / Fillek), a dalból kivágott hangjával', 'Becomes a library item (Grooves / Fills) with its audio cut from the song')}>{pick('TANANYAGBA', 'TO LIBRARY')}</button>
        {!song && <button className="btn small" onClick={() => commit(() => model.duplicate())} title={pick('Új, önálló elem ennek a másolatából', 'A new, separate part copied from this one')}>{pick('MÁSOLAT', 'COPY')}</button>}
        {!song && (
          <button className="btn small" onClick={() => {
            const { n, withVariants } = model.deleteCount();
            if (n && !confirm(pick(`„${model.pname(k)}” ${n} ütemben szerepel${withVariants ? ' (a variációival együtt)' : ''}; ott szünet lesz helyette. Törlöd?`, `"${model.pname(k)}" is used in ${n} bars${withVariants ? ' (with its variations)' : ''}; they become rests. Delete?`))) return;
            commit(() => model.deletePattern());
          }}>{pick('TÖRLÉS', 'DELETE')}</button>
        )}
      </div>
      <div className="ed-pe-preview" dangerouslySetInnerHTML={{ __html: preview.join('') }} />
      <div
        className="ed-grid"
        ref={grid}
        onPointerDown={(e) => {
          const c = (e.target as HTMLElement).closest<HTMLElement>('.cell');
          if (!c || e.button !== 0) return;
          e.preventDefault();
          grid.current?.setPointerCapture(e.pointerId);
          noteDrag.current = { cell: c, x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = noteDrag.current;
          if (!d || !d.cell.classList.contains('on')) return;
          if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
          d.moved = true;
          clearMarks();
          d.cell.classList.add('drag-src');
          const t = cellAt(e.clientX, e.clientY);
          if (t && t !== d.cell) t.classList.add('drag-over');
          if (!t) d.cell.classList.add('drag-del');   // a rácson kívül: törlődik
          document.body.style.cursor = t ? 'grabbing' : 'no-drop';
        }}
        onPointerUp={(e) => {
          const d = noteDrag.current;
          noteDrag.current = null;
          clearMarks();
          if (!d) return;
          if (!d.moved) return commit(() => model.cycleCell(...pos(d.cell)));
          const t = cellAt(e.clientX, e.clientY);
          if (t === d.cell) return;
          commit(() => model.moveCell(pos(d.cell), t ? pos(t) : null));
        }}
        onPointerCancel={() => {
          noteDrag.current = null;
          clearMarks();
        }}
      >
        {Array.from({ length: L }, (_, b) => {
          const beats = [0, 1, 2, 3].map((i) => b * 4 + i);
          return (
            <div key={b} className="ed-grid-bar">
              {L > 1 && <div className={`gbar${b + 1 === cur ? ' cur' : ''}`}>{b + 1}. {pick('ÜTEM', 'BAR')}{b + 1 === cur ? pick(' · ez az ütem', ' · this bar') : ''}</div>}
              <span />
              {beats.map((bi) => (
                <select key={bi} value={slots[bi].length} onChange={(e) => commit(() => model.setSubdivision(bi, +e.target.value))} title={pick(`${(bi % 4) + 1}. negyed felosztása`, `subdivision of beat ${(bi % 4) + 1}`)}>
                  {SUBDIV.map(([n, name]) => <option key={n} value={n}>{(bi % 4) + 1}. · {name}</option>)}
                </select>
              ))}
              {INST.map(([ins, name]) => (
                <Row key={ins} label={name}>
                  {beats.map((bi) => (
                    <div key={bi} className="cells">
                      {slots[bi].map((m, si) => {
                        const mod = m.get(ins);
                        return (
                          <button
                            key={si}
                            className={`cell${mod === undefined ? '' : mod === '>' ? ' on acc' : mod === 'g' ? ' on ghost' : ' on'}`}
                            data-beat={bi} data-slot={si} data-ins={ins}
                            title={`${name} · ${b + 1}. ${pick('ütem', 'bar')} ${(bi % 4) + 1}. ${pick('negyed', 'beat')} ${si + 1}/${slots[bi].length}`}
                          >
                            {mod === '>' ? '>' : mod === 'g' ? '( )' : ''}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </Row>
              ))}
              <Row label={pick('KÉZREND', 'STICKING')} hands>
                {beats.map((bi) => (
                  <div key={bi} className="cells hands">
                    {hands[bi].map((x, si) => (
                      <div key={si} className="hand">
                        {(['R', 'L'] as const).map((side) => (
                          <button key={side} className={`hb${x === side ? ' on' : ''}`} onClick={() => commit(() => model.toggleHand(bi, si, side))} title={`${side === 'R' ? pick('jobb', 'right') : pick('bal', 'left')} · ${(bi % 4) + 1}. ${pick('negyed', 'beat')} ${si + 1}/${hands[bi].length}`}>
                            {side}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </Row>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, hands, children }: { label: string; hands?: boolean; children: React.ReactNode }) {
  return (
    <>
      <span className={`lbl${hands ? ' hands-lbl' : ''}`}>{label}</span>
      {children}
    </>
  );
}

