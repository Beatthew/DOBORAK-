import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SongMixer } from '../components/SongMixer';
import { TopBar } from '../components/TopBar';
import { songPath } from '../data/catalog';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { EditorModel, INST, LENS, SUBDIV, keyOf, parseBeat, partOf } from '../songs/editorModel';
import { SongEngine } from '../songs/engine';
import { rowSVG } from '../songs/notation';
import { dropSong, findSong, loadSongData, patchSong, useSongs, type SongRow } from '../songs/store';
import { applyRegrid, irregularBars, type BarRef, type PatternType } from '../songs/structure';
import type { Beats } from '../songs/types';

/* A dal szerkesztője: a MuseScore egyszerűsített változata. Középen a teljes dal egy kottalapon (4 ütemes sorok,
   a szekciójelölők a kottán, fel-le húzhatók); bal oldalt a groove-ok, fillek és szekciójelölők (ráhúzhatók); jobbra a keverő.
   Kattintás: kijelölés (Shift: tartomány, Ctrl: hozzáadás) · dupla katt: alulról az ütem szerkesztője · jobb klikk: menü
   (mentés groove-ként / fillként…) · Ctrl+C / Ctrl+V · Enter: sortörés · Delete: ürítés. Minden változtatás magától mentődik
   (a songs.structure-be), és a közzétett dalt a diákok azonnal az újjal kapják. A logika: songs/editorModel.ts. */

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** egy ütem kottája (kézrenddel), a dal ütemszámával; a fill ütem homokszínű alapot kap */
function barSvg(beats: string[] | null, hands: string[] | null, label: number | string, isFill: boolean, w = 500) {
  const b: Beats | null = beats ? Object.assign([...beats], hands ? { hands } : {}) : null;
  const n = typeof label === 'number' ? label : 0;
  return rowSVG([b], [label], w, { fillBars: new Set(isFill ? [n] : []), rideBars: new Set() });
}

const svgCache = new Map<string, string>();
function barSvgCached(beats: string[] | null, hands: string[] | null, label: number | string, isFill: boolean) {
  const key = JSON.stringify([beats, hands, label, isFill]);
  let v = svgCache.get(key);
  if (!v) {
    v = barSvg(beats, hands, label, isFill, 300);
    if (svgCache.size > 2000) svgCache.clear();
    svgCache.set(key, v);
  }
  return v;
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

  /* mappa és törlés: a Dalok lista csak sorokat mutat, ezek ide kerültek */
  const allSongs = useSongs();
  const folders = useMemo(() => [...new Set((allSongs ?? []).map((s) => s.folder).filter((f): f is string => !!f))].sort(), [allSongs]);
  const [folder, setFolder] = useState(row.folder ?? '');
  const moveTo = async (v: string) => {
    if (!supabase) return;
    let next: string | null = v || null;
    if (v === '+') {
      next = prompt(pick('Az új mappa neve:', 'New folder name:'))?.trim().slice(0, 60) || null;
      if (!next) return;
    }
    const { error } = await supabase.from('songs').update({ folder: next }).eq('id', row.id);
    if (error) return setMsg({ text: error.message, err: true });
    setFolder(next ?? '');
    patchSong({ id: row.id, folder: next });
  };
  const removeSong = async () => {
    if (!supabase || !confirm(pick(`Törlöd: ${title}? A sávjai is törlődnek, és az órákhoz csatolt hivatkozások nem nyílnak meg többé. Nem vonható vissza.`, `Delete ${title}? Its tracks are deleted too, and lessons linking to it will no longer open it. This cannot be undone.`))) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    await supabase.storage.from('songs').remove([`${row.id}/drums.mp3`, `${row.id}/band.mp3`]);
    const { error } = await supabase.from('songs').delete().eq('id', row.id);
    if (error) return setMsg({ text: error.message, err: true });
    dropSong(row.id);
    nav('/tananyag/dalok', { replace: true });
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

  /* ---------- a vászon: kijelölés, vágólap, alsó panel, menük ---------- */
  const [sel, setSel] = useState<number[]>([]);
  const anchor = useRef(0);
  const clip = useRef<BarRef[] | null>(null);
  const [panel, setPanel] = useState<{ title: string; snap: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; sec?: number } | null>(null);
  const [palTab, setPalTab] = useState<'groove' | 'fill' | 'sec'>('groove');
  const sheetRef = useRef<HTMLDivElement>(null);
  const S = model.S;
  const irregular = useMemo(() => irregularBars(S.downbeats).length, [S]);
  const sorted = [...sel].sort((x, y) => x - y);

  const pickBar = (gi: number, e: ReactMouseEvent) => {
    setMenu(null);
    if (e.shiftKey) {
      const lo = Math.min(anchor.current, gi), hi = Math.max(anchor.current, gi);
      setSel(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
    } else if (e.ctrlKey || e.metaKey || e.altKey) {
      setSel((cur) => (cur.includes(gi) ? cur.filter((x) => x !== gi) : [...cur, gi]));
      anchor.current = gi;
    } else {
      setSel([gi]);
      anchor.current = gi;
    }
  };
  const openBar = (gi: number) => {
    const snap = model.snap();
    model.openBar(gi);
    setSel([gi]);
    anchor.current = gi;
    setMenu(null);
    setPanel({ title: `${gi + 1}. ${pick('ütem', 'bar')}`, snap });
    bump();
  };
  const openPattern = (k: string) => {
    const snap = model.snap();
    model.openPattern(k);
    setPanel({ title: model.pname(k), snap });
    bump();
  };
  const closePanel = (ok: boolean) => {
    if (!panel) return;
    if (!ok) model.restoreSnap(panel.snap);
    setPanel(null);
    commit(() => {});
  };
  const copy = () => {
    if (!sorted.length) return;
    clip.current = sorted.map((gi) => model.refAt(gi));
    setMsg({ text: pick(`másolva: ${sorted.length} ütem`, `copied: ${sorted.length} bars`) });
  };
  const paste = () => {
    if (!clip.current) return setMsg({ text: pick('A vágólap üres (Ctrl+C)', 'The clipboard is empty (Ctrl+C)'), err: true });
    if (!sorted.length) return;
    commit(() => model.pasteRefs(sorted, clip.current!));
  };
  const clear = () => sorted.length && commit(() => model.placeOn(sorted, null));
  const lineBreak = () => sorted.length && commit(() => model.toggleBreak(sorted[sorted.length - 1]));
  const saveAs = (type: PatternType) => {
    if (!sorted.length) return;
    const name = prompt(type === 'fill' ? pick('A fill neve:', 'Fill name:') : pick('A groove neve:', 'Groove name:'))?.trim();
    if (!name) return;
    commit(() => model.saveAsElement(sorted, name, type));
    setPalTab(type);
    setMsg({ text: pick(`„${name}” bekerült a ${type === 'fill' ? 'fillek' : 'groove-ok'} közé`, `"${name}" added to the ${type === 'fill' ? 'fills' : 'grooves'}`) });
  };
  const newSection = (gi: number, name?: string) => {
    const n = (name ?? prompt(pick('A szekció neve:', 'Section name:'), 'VERSE'))?.trim().toUpperCase();
    if (n) commit(() => model.addSectionAt(gi, n));
  };

  // billentyűk a vásznon (beviteli mezőben és nyitott panel mellett nem)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
      if (ev.key === 'Escape') {
        if (menu) setMenu(null);
        else if (panel) closePanel(false);
        return;
      }
      if (panel) return;
      const ctrl = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
      if (ctrl && k === 'c') { ev.preventDefault(); copy(); }
      else if (ctrl && k === 'v') { ev.preventDefault(); paste(); }
      else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); clear(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); lineBreak(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const n = model.totalBars(), from = sorted.length ? (ev.key === 'ArrowRight' ? sorted[sorted.length - 1] : sorted[0]) : 0;
        const gi = Math.max(0, Math.min(n - 1, from + (ev.key === 'ArrowRight' ? 1 : -1)));
        setSel([gi]);
        anchor.current = gi;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // lejátszás közben a szóló ütem látszik a vásznon
  useEffect(() => {
    if (!playing || bar < 1) return;
    sheetRef.current?.querySelector(`[data-gi="${bar - 1}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [bar, playing]);

  /* ---------- húzás: a bal panelről (groove, fill, szekció) és a szekciójelölők ---------- */
  const onDrop = (gi: number | null, secIdx: number | null) => (e: ReactDragEvent) => {
    e.preventDefault();
    sheetRef.current?.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('pat:')) {
      const k = data.slice(4);
      if (secIdx !== null) return commit(() => model.fillSection(secIdx, k));
      if (gi === null) return;
      commit(() => model.placeOn(sel.includes(gi) ? sorted : [gi], k));
    } else if (data.startsWith('sec:') && gi !== null) newSection(gi, data.slice(4));
  };
  const onDragOver = (e: ReactDragEvent) => {
    e.preventDefault();
    sheetRef.current?.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    (e.currentTarget as HTMLElement).classList.add('drop');
  };
  const pinDrag = useRef<{ i: number; moved: boolean; x: number; y: number } | null>(null);
  const barUnder = (x: number, y: number) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-gi]');
    return el ? +el.dataset.gi! : null;
  };

  const rows = model.rowsLayout();
  const sp = model.spans();
  const startOf = new Map(sp.map((x, i) => [x.from - 1, i]));
  const flat = model.flatBars();
  const nowBar = playing ? bar - 1 : -1;

  return (
    <div className="se">
      <header className="se-top">
        <Link className="se-back" to={back} aria-label={pick('Vissza a dalokhoz', 'Back to songs')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <button className="se-play" onClick={toggle} disabled={!engine} aria-label={playing ? pick('Szünet', 'Pause') : pick('Lejátszás', 'Play')}>
          {playing ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>}
        </button>
        <div className="se-title">
          <b>{title}{row.artist ? ` – ${row.artist}` : ''}</b>
          <div
            className="se-progress"
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
          <small>
            <span id="ed-time">0:00</span> / {loadErr ? <span className="error-text">{loadErr}</span> : engine ? fmt(engine.duration) : pick('sávok betöltése…', 'loading tracks…')}
            {' · '}{S.bpm} BPM
            {irregular > 0 && <em title={pick('Ezekben az ütemekben a klikk rohan vagy lassul: TEMPÓ ÚJRA', 'The click races or drags in these bars: RECALC TEMPO')}> · ⚠ {irregular} {pick('gyanús ütem', 'suspicious bars')}</em>}
          </small>
        </div>
        <div className="se-bars">{pick('ÜTEM', 'BAR')} <b>{Math.max(bar, 1)}</b><span>/{model.totalBars()}</span></div>
        <div className="se-tools">
          <button className="se-tool" disabled={!model.canUndo()} onClick={() => { model.undo(); scheduleSave(); bump(); }} aria-label={pick('Vissza (Ctrl+Z)', 'Undo (Ctrl+Z)')} title="Ctrl+Z">↶</button>
          <button className="se-tool" disabled={!model.canRedo()} onClick={() => { model.redo(); scheduleSave(); bump(); }} aria-label={pick('Előre (Ctrl+Y)', 'Redo (Ctrl+Y)')} title="Ctrl+Y">↷</button>
          <button className="se-tool" onClick={() => void regrid()} title={pick('Ahol az ütemfelismerés félreütemezett, egyenletes ütemrácsot épít; a szekciók és a kotta idő szerint átkerülnek', 'Builds a steady bar grid where detection misplaced bars')}>{pick('TEMPÓ ÚJRA', 'RECALC TEMPO')}</button>
          <label className="se-tool se-check"><input type="checkbox" checked={published} onChange={() => void togglePublish()} />{pick('KÖZZÉTÉVE', 'PUBLISHED')}</label>
          <select className="se-tool se-folder" value={folder} onChange={(e) => void moveTo(e.target.value)} aria-label={pick('Mappa', 'Folder')}>
            <option value="">{pick('Nincs mappában', 'No folder')}</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="+">{pick('+ Új mappa…', '+ New folder…')}</option>
          </select>
          <button className="se-tool" onClick={() => void removeSong()}>{pick('TÖRLÉS', 'DELETE')}</button>
          <div className="se-save">
            <button onClick={() => void saveNow().then((ok) => ok && setMsg({ text: `${pick('mentve', 'saved')} · ${new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}` }))}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>
              {pick('MENTÉS', 'SAVE')}
            </button>
            <small className={msg.err ? 'err' : ''}>{msg.text}</small>
          </div>
        </div>
        <div className="se-mode">
          <button className="on" aria-pressed="true">EDIT</button>
          <button onClick={() => void practice()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
            PREVIEW
          </button>
        </div>
      </header>

      <div className="se-body">
        <Palette model={model} tab={palTab} onTab={setPalTab} onEdit={openPattern} onLibrary={(k) => void toLibrary(k)} />

        <main className="se-canvas" onClick={(e) => e.target === e.currentTarget && setSel([])}>
          <div className="se-sheet" ref={sheetRef}>
            <h1>{title}</h1>
            <p className="se-sub">{[row.artist, `${S.bpm} BPM`, `${model.totalBars()} ${pick('ütem', 'bars')}`].filter(Boolean).join(' · ')}</p>
            {rows.map((r) => {
              const si = startOf.get(r[0]);
              const blk = si !== undefined ? model.blocks[si] : null;
              return (
                <div key={r[0]} className={`se-row${blk ? ' sec' : ''}`}>
                  {blk && si !== undefined && (
                    <>
                      <span className="se-rule" aria-hidden="true" />
                      <button
                        className={`se-pin${blk.tacet ? ' tacet' : ''}`}
                        title={pick('Húzd egy ütemre: ott kezdődik a szekció · ráhúzott groove: az egész szekciót kitölti · jobb klikk: átnevezés, tacet, törlés', 'Drag onto a bar: the section starts there · drop a groove: fills the section · right-click: rename, tacet, delete')}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          try {
                            e.currentTarget.setPointerCapture(e.pointerId);
                          } catch {
                            /* a mutató már nincs lenyomva */
                          }
                          pinDrag.current = { i: si, moved: false, x: e.clientX, y: e.clientY };
                        }}
                        onPointerMove={(e) => {
                          const d = pinDrag.current;
                          if (!d) return;
                          if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
                          d.moved = true;
                          sheetRef.current?.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
                          const gi = barUnder(e.clientX, e.clientY);
                          if (gi !== null) sheetRef.current?.querySelector(`[data-gi="${gi}"]`)?.classList.add('drop');
                        }}
                        onPointerUp={(e) => {
                          const d = pinDrag.current;
                          pinDrag.current = null;
                          sheetRef.current?.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
                          if (!d) return;
                          if (!d.moved) return seekBar(sp[si].from);
                          const gi = barUnder(e.clientX, e.clientY);
                          if (gi !== null && gi !== sp[si].from - 1) commit(() => model.moveSectionStart(si, gi));
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu({ x: e.clientX, y: e.clientY, sec: si });
                        }}
                        onDragOver={onDragOver}
                        onDrop={onDrop(null, si)}
                      >
                        {blk.name}{blk.tacet ? ' · TACET' : ''}
                      </button>
                    </>
                  )}
                  {r.map((gi) => {
                    const ref = flat[gi], ok = model.okRef(ref), p = ok ? model.patterns[keyOf(ref)!] : null;
                    const tag = !p ? '' : p.draft ? pick('saját', 'own') : model.pname(ref);
                    const tagCls = !p ? '' : p.draft ? ' own' : p.type === 'fill' ? ' fill' : p.variantOf ? ' var' : '';
                    const tacet = model.blocks[model.blockOfBar(gi)]?.tacet;
                    return (
                      <button
                        key={gi}
                        data-gi={gi}
                        className={`se-bar${sel.includes(gi) ? ' sel' : ''}${gi === nowBar ? ' now' : ''}${tacet ? ' tacet' : ''}`}
                        onClick={(e) => pickBar(gi, e)}
                        onDoubleClick={() => openBar(gi)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!sel.includes(gi)) { setSel([gi]); anchor.current = gi; }
                          setMenu({ x: e.clientX, y: e.clientY });
                        }}
                        onDragOver={onDragOver}
                        onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
                        onDrop={onDrop(gi, null)}
                        aria-label={`${gi + 1}. ${pick('ütem', 'bar')}${tag ? ` · ${tag}` : ''}`}
                      >
                        {tag && <span className={`se-tag${tagCls}`}>{tag}{p && model.plen(keyOf(ref)) > 1 ? ` ${partOf(ref)}/${model.plen(keyOf(ref))}` : ''}</span>}
                        <span className="se-notes" dangerouslySetInnerHTML={{ __html: barSvgCached(model.partBeats(ref), model.partHands(ref), gi + 1, model.isFillKey(ref)) }} />
                        {model.breaks.has(gi) && <span className="se-break" title={pick('Kézi sortörés (Enter)', 'Manual line break (Enter)')}>↵</span>}
                      </button>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 4 - r.length) }, (_, i) => <span key={`f${i}`} className="se-bar ghost" aria-hidden="true" />)}
                </div>
              );
            })}
          </div>
          <p className="se-keys">{pick('Kattintás: kijelölés · Shift: tartomány · Ctrl: hozzáadás · dupla katt: szerkesztés · jobb klikk: menü · Ctrl+C / Ctrl+V · Enter: sortörés · Delete: ürítés · a szekciójelölőket húzd', 'Click: select · Shift: range · Ctrl: add · double-click: edit · right-click: menu · Ctrl+C / Ctrl+V · Enter: line break · Delete: clear · drag the section markers')}</p>
        </main>

        <aside className="se-mixer">
          <SongMixer engine={engine} variant="console" />
        </aside>
      </div>

      {panel && (
        <section className="se-panel" aria-label={pick('Ütem szerkesztése', 'Edit bar')}>
          <div className="se-panel-head">
            <h2>{panel.title}</h2>
            <span>{model.tab === 'song' ? pick('Egy groove-os ütem átírva variáció lesz; a groove maga nem változik.', 'Editing a groove bar makes a variation; the groove itself stays.') : pick('Az elemet minden ütem játssza, ahol szerepel.', 'Every bar using this part changes.')}</span>
            <span className="sp" />
            <button className="se-round" onClick={() => closePanel(false)} aria-label={pick('Mégse (Esc)', 'Cancel (Esc)')}>✕</button>
            <button className="se-round ok" onClick={() => closePanel(true)} aria-label={pick('Kész', 'Done')}>✓</button>
          </div>
          <PatternEditor model={model} commit={commit} onLibrary={(k) => void toLibrary(k)} />
        </section>
      )}

      {menu && (
        <div className="se-menu" role="menu" style={{ left: Math.min(menu.x, window.innerWidth - 270), top: Math.min(menu.y, window.innerHeight - 380) }} onClick={() => setMenu(null)}>
          {menu.sec === undefined ? (
            <>
              <button className="main" onClick={() => saveAs('groove')}>{pick('Mentés groove-ként…', 'Save as groove…')}</button>
              <button className="main" onClick={() => saveAs('fill')}>{pick('Mentés fillként…', 'Save as fill…')}</button>
              <hr />
              <button onClick={() => sorted.length && openBar(sorted[0])}>{pick('Szerkesztés', 'Edit')}<small>{pick('dupla katt', 'double-click')}</small></button>
              <button onClick={copy}>{pick('Másolás', 'Copy')}<small>Ctrl+C</small></button>
              <button onClick={paste}>{pick('Beillesztés', 'Paste')}<small>Ctrl+V</small></button>
              <button onClick={clear}>{pick('Ürítés', 'Clear')}<small>Del</small></button>
              {sorted.length > 0 && model.okRef(model.refAt(sorted[0])) && !model.patterns[keyOf(model.refAt(sorted[0]))!].draft && (
                <button onClick={() => void toLibrary(model.baseOf(model.refAt(sorted[0]))!)}>{pick('Tananyagba (a dal hangjával)', 'To library (with the song audio)')}</button>
              )}
              <hr />
              <button onClick={lineBreak}>{pick('Sortörés utána', 'Line break after')}<small>Enter</small></button>
              <button onClick={() => sorted.length && newSection(sorted[0])}>{pick('Új szekció itt…', 'New section here…')}</button>
            </>
          ) : (
            <>
              <button onClick={() => {
                const n = prompt(pick('A szekció neve:', 'Section name:'), model.blocks[menu.sec!].name)?.trim();
                if (n) commit(() => model.rename(menu.sec!, n));
              }}>{pick('Átnevezés…', 'Rename…')}</button>
              <button onClick={() => commit(() => model.setTacet(menu.sec!, !model.blocks[menu.sec!].tacet))}>
                {model.blocks[menu.sec].tacet ? pick('Van benne dob (tacet ki)', 'Drums play (tacet off)') : pick('Tacet: nincs benne dob', 'Tacet: no drums')}
              </button>
              {model.blocks.length > 1 && (
                <button onClick={() => commit(() => model.mergeBlock(menu.sec!))}>{pick('Szekció törlése (összevonás az előzővel)', 'Delete section (merge with previous)')}</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- bal panel: groove-ok, fillek, szekciójelölők */

function Palette({ model, tab, onTab, onEdit, onLibrary }: { model: EditorModel; tab: 'groove' | 'fill' | 'sec'; onTab: (t: 'groove' | 'fill' | 'sec') => void; onEdit: (k: string) => void; onLibrary: (k: string) => void }) {
  const { pick } = useI18n();
  const uses = model.useCount();
  const drag = (data: string) => (e: ReactDragEvent) => {
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const card = (k: string, variant: boolean) => {
    const p = model.patterns[k];
    return (
      <div key={k} className={`se-el${p.type === 'fill' ? ' fill' : ''}${variant ? ' var' : ''}`} draggable onDragStart={drag(`pat:${k}`)}>
        <header>
          <span className="grip" aria-hidden="true">⋮⋮</span>
          <b>{variant ? `↳ ${p.name}` : p.name}</b>
          <small>{Math.ceil((uses[k] || 0) / model.plen(k))}×{model.plen(k) > 1 ? ` · ${model.plen(k)} ${pick('ütem', 'bars')}` : ''}</small>
          <button onClick={() => onEdit(k)} aria-label={`${pick('Szerkesztés', 'Edit')}: ${p.name}`} title={pick('Szerkesztés (minden helyén változik)', 'Edit (changes everywhere)')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l1-5L16 4l4 4L9 19l-5 1z" /></svg>
          </button>
          <button onClick={() => onLibrary(k)} aria-label={`${pick('Tananyagba', 'To library')}: ${p.name}`} title={pick('Tananyagba, a dal hangjával', 'To library, with the song audio')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" /></svg>
          </button>
        </header>
        <span className="se-el-notes" dangerouslySetInnerHTML={{ __html: barSvgCached(p.beats.slice(0, 4), p.hands?.slice(0, 4) ?? null, '', p.type === 'fill') }} />
      </div>
    );
  };
  return (
    <aside className="se-palette">
      <nav className="se-tabs">
        {([['groove', pick('GROOVE-OK', 'GROOVES')], ['fill', pick('FILLEK', 'FILLS')], ['sec', pick('SZEKCIÓK', 'SECTIONS')]] as const).map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => onTab(t)}>{label}</button>
        ))}
      </nav>
      <div className="se-pal-list">
        {tab === 'sec' ? (
          <>
            <p className="hint">{pick('Húzd egy ütemre: ott kezdődik a szekció. A második VERSE neve VERSE 2 lesz.', 'Drag onto a bar: the section starts there. A second VERSE becomes VERSE 2.')}</p>
            <div className="se-markers">
              {['INTRO', 'VERSE', 'PRE-CHORUS', 'REFRÉN', 'BRIDGE', 'OUTRO'].map((n) => (
                <span key={n} className="se-marker" draggable onDragStart={drag(`sec:${n}`)}>{n}</span>
              ))}
            </div>
            <p className="hint">{pick('Saját név: jobb klikk egy ütemen → Új szekció itt. A kottán lévő jelölőket fel-le húzhatod; jobb klikkel átnevezheted, tacetre állíthatod vagy törölheted.', 'Own name: right-click a bar → New section here. Drag the markers on the sheet; right-click to rename, set tacet or delete.')}</p>
          </>
        ) : (
          <>
            <p className="hint">{pick('Húzd egy ütemre, a kijelölésre vagy egy szekciójelölőre (az egész szekciót kitölti).', 'Drag onto a bar, the selection or a section marker (fills the whole section).')}</p>
            {model.cores(tab).flatMap((c) => [card(c.key, false), ...c.variants.map((v) => card(v, true))])}
            {!model.cores(tab).length && <p className="hint">{pick(`Még nincs. Jobb klikk egy ütemen → „Mentés ${tab === 'fill' ? 'fillként' : 'groove-ként'}”.`, `None yet. Right-click a bar → "Save as ${tab}".`)}</p>}
          </>
        )}
      </div>
    </aside>
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

