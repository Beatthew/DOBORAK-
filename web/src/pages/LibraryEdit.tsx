import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ScorePlayer } from '../components/Score';
import { TopBar } from '../components/TopBar';
import { formatScoreCode, MISSING_TABLES, parseScoreCode, toBeats, useLibrary, type LibraryItem, type ScoreBar } from '../data/library';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';

/* Új tétel két úton: kézzel építve (a Song Practice szerkesztője szerint), vagy képről / kottáról átírva. */

type Mode = 'hand' | 'image';

const INST: [string, string][] = [
  ['c', 'Crash'],
  ['r', 'Ride'],
  ['o', 'Nyitott HH'],
  ['h', 'Hihat'],
  ['t', 'Kistam'],
  ['u', 'Középtam'],
  ['s', 'Pergő'],
  ['f', 'Álló tam'],
  ['k', 'Lábdob'],
];
const LENGTHS = [1, 2, 4];
const DIVISIONS: [number, string][] = [
  [1, 'negyed'],
  [2, '8-ad'],
  [3, 'triola'],
  [4, '16-od'],
  [6, 'szextola'],
];
const emptyBar = (): ScoreBar => ({ beats: ['- -', '- -', '- -', '- -'] });

/** 'h+(s) k>' → slotonként: hangszer → jel ('' sima, '>' hangsúly, 'g' ghost) */
function parseBeat(beat: string): Map<string, string>[] {
  return beat.trim().split(/\s+/).map((slot) => {
    const m = new Map<string, string>();
    if (slot !== '-')
      slot.split('+').forEach((tok) => m.set(tok.replace(/[()>]/g, ''), tok.startsWith('(') ? 'g' : tok.endsWith('>') ? '>' : ''));
    return m;
  });
}
const serBeat = (slots: Map<string, string>[]) =>
  slots
    .map((m) => [...m].map(([ins, mod]) => (mod === 'g' ? `(${ins})` : ins + mod)).join('+') || '-')
    .join(' ');

/** A negyed új felosztása: ami az új rácsra esik, megmarad. */
function redivide(beat: string, n: number) {
  const old = parseBeat(beat);
  return serBeat(
    Array.from({ length: n }, (_, i) => {
      const at = (i * old.length) / n;
      return Number.isInteger(at) ? old[at] : new Map<string, string>();
    }),
  );
}

export function LibraryEdit() {
  const { pick, text } = useI18n();
  const { cat = '', item: itemId } = useParams();
  const { categories, items, ready } = useLibrary();
  const { state } = useLocation() as { state: { copyOf?: LibraryItem } | null };
  const existing = items.find((i) => i.id === itemId);
  const seed = existing ?? state?.copyOf;
  const backLabel = text(categories.find((c) => c.id === cat)?.name ?? 'Tananyag');
  const [mode, setMode] = useState<Mode | null>(seed ? 'hand' : null);

  if (itemId && !existing) {
    return (
      <>
        <TopBar title={backLabel} backTo={`/tananyag/${cat}`} backLabel={backLabel} />
        <main className="page">
          <p className="muted">{ready ? pick('Ez a tétel nem található.', 'This item does not exist.') : pick('Betöltés…', 'Loading…')}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={existing ? text(existing.title) : pick('Új tétel', 'New item')} backTo={`/tananyag/${cat}`} backLabel={backLabel} />
      <main className="page">
        {mode === null ? (
          <nav className="home-tiles">
            <button className="home-tile tone-0" onClick={() => setMode('hand')}>
              {pick('Kézzel építem', 'Build by hand')}
            </button>
            <button className="home-tile tone-1" onClick={() => setMode('image')}>
              {pick('Képről írom át', 'Transcribe from image')}
            </button>
          </nav>
        ) : (
          <Editor key={mode} mode={mode} category={cat} existing={existing} seed={seed} />
        )}
      </main>
    </>
  );
}

interface EditorProps {
  mode: Mode;
  category: string;
  existing?: LibraryItem;
  seed?: LibraryItem;
}

function Editor({ mode, category, existing, seed }: EditorProps) {
  const { pick, text } = useI18n();
  const nav = useNavigate();
  const [title, setTitle] = useState(existing?.title ?? (seed ? pick(`${seed.title} másolat`, `${seed.title} copy`) : ''));
  const [subtitle, setSubtitle] = useState(seed?.subtitle ?? '');
  const [note, setNote] = useState(seed?.note ?? '');
  const [bpm, setBpm] = useState(seed?.bpm ?? 90);
  const [handBars, setHandBars] = useState<ScoreBar[]>(seed?.bars.length ? seed.bars : [emptyBar()]);
  const [code, setCode] = useState(seed ? formatScoreCode(seed.bars) : '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseScoreCode(code, pick), [code, pick]);
  const bars = mode === 'hand' ? handBars : parsed.bars;
  const beats = useMemo(() => bars.map(toBeats), [bars]);

  const save = async () => {
    if (!supabase) return;
    if (!title.trim()) return alert(pick('Adj nevet a tételnek.', 'Give the item a name.'));
    if (mode === 'image' && parsed.error) return alert(parsed.error);
    if (mode === 'image' && !bars.length && !file) return alert(pick('Tölts fel egy képet, vagy írd be a kottakódot.', 'Upload an image or enter the score code.'));
    setBusy(true);
    let image_path = existing?.image_path ?? null;
    let file_name = existing?.file_name ?? null;
    if (file) {
      const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      image_path = `tananyag/${Date.now()}-${safe}`;
      file_name = file.name;
      const up = await supabase.storage.from('materials').upload(image_path, file, { contentType: file.type || undefined });
      if (up.error) {
        setBusy(false);
        return alert(`${pick('A feltöltés nem sikerült', 'Upload failed')}: ${up.error.message}`);
      }
    }
    const row = { category, title: title.trim(), subtitle: subtitle.trim(), note: note.trim(), bpm, bars, image_path, file_name };
    const { error } = existing
      ? await supabase.from('library_items').update(row).eq('id', existing.id)
      : await supabase.from('library_items').insert(row);
    setBusy(false);
    if (error) return alert(/library_items/.test(error.message) ? text(MISSING_TABLES) : error.message);
    nav(`/tananyag/${category}`, { replace: true });
  };

  return (
    <>
      <div className="form">
        <label>
          {pick('Név', 'Name')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pick('pl. Money Beat', 'e.g. Money Beat')} />
        </label>
        <label>
          {pick('Alcím', 'Subtitle')}
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={pick('pl. Groove 1', 'e.g. Groove 1')} />
        </label>
      </div>
      {mode === 'hand' ? <Builder bars={handBars} onChange={setHandBars} /> : <ImageCode code={code} onCode={setCode} error={parsed.error} file={file} onFile={setFile} />}
      {beats.length > 0 && <ScorePlayer id="edit" bars={beats} bpm={bpm} onBpm={setBpm} />}
      <label className="form">
        {pick('Megjegyzés', 'Note')}
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn primary big" disabled={busy} onClick={() => void save()}>
        {busy ? pick('Mentés…', 'Saving…') : pick('Mentés a tananyagba', 'Save to library')}
      </button>
    </>
  );
}

/** Kézi bevitel: hangszerenként egy sor, negyedenként választható felosztás; kattintás: hang → hangsúly → ghost → töröl. */
function Builder({ bars, onChange }: { bars: ScoreBar[]; onChange: (bars: ScoreBar[]) => void }) {
  const { t, pick, text } = useI18n();
  const setBar = (b: number, bar: ScoreBar) => onChange(bars.map((x, i) => (i === b ? bar : x)));

  const setLength = (n: number) => {
    if (n < bars.length && !confirm(pick(`${bars.length} ütemből ${n} lesz: a többi ütem kottája törlődik. Mehet?`, `${bars.length} bars become ${n}: the score of the other bars is deleted. Continue?`))) return;
    const last = bars[bars.length - 1];
    onChange(Array.from({ length: n }, (_, i) => bars[i] ?? { ...last }));
  };

  const setDivision = (b: number, q: number, n: number) => {
    const bar = bars[b];
    const hands = bar.hands?.map((h, i) => (i === q ? Array(n).fill('-').join(' ') : h));
    setBar(b, { beats: bar.beats.map((x, i) => (i === q ? redivide(x, n) : x)), ...(hands ? { hands } : {}) });
  };

  const cycle = (b: number, q: number, s: number, ins: string) => {
    const slots = parseBeat(bars[b].beats[q]);
    const mod = slots[s].get(ins);
    if (mod === undefined) slots[s].set(ins, '');
    else if (mod === '') slots[s].set(ins, '>');
    else if (mod === '>') slots[s].set(ins, 'g');
    else slots[s].delete(ins);
    setBar(b, { ...bars[b], beats: bars[b].beats.map((x, i) => (i === q ? serBeat(slots) : x)) });
  };

  const setHand = (b: number, q: number, s: number, side: string) => {
    const bar = bars[b];
    const all = bar.beats.map((beat, i) => {
      const n = beat.trim().split(/\s+/).length;
      const old = (bar.hands?.[i] ?? '').trim().split(/\s+/);
      return Array.from({ length: n }, (_, k): string => (old[k] === 'R' || old[k] === 'L' ? old[k] : '-'));
    });
    all[q][s] = all[q][s] === side ? '-' : side;
    const { hands: _drop, ...rest } = bar;
    setBar(b, all.some((h) => h.some((x) => x !== '-')) ? { ...rest, hands: all.map((h) => h.join(' ')) } : rest);
  };

  return (
    <section className="builder">
      <div className="seg" role="group" aria-label={pick('Hossz', 'Length')}>
        {LENGTHS.map((n) => (
          <button type="button" key={n} className={n === bars.length ? 'on' : ''} onClick={() => setLength(n)}>
            {t.bars(n)}
          </button>
        ))}
      </div>
      <div className="builder-scroll">
        {bars.map((bar, b) => (
          <div className="builder-grid" key={b}>
            {bars.length > 1 && <div className="builder-bar">{pick(`${b + 1}. ütem`, `Bar ${b + 1}`)}</div>}
            <span />
            {bar.beats.map((beat, q) => (
              <select key={q} aria-label={pick(`${q + 1}. negyed felosztása`, `Division of beat ${q + 1}`)} value={beat.trim().split(/\s+/).length} onChange={(e) => setDivision(b, q, +e.target.value)}>
                {DIVISIONS.map(([n, label]) => (
                  <option key={n} value={n}>
                    {pick(`${q + 1}. negyed`, `Beat ${q + 1}`)} · {text(label)}
                  </option>
                ))}
              </select>
            ))}
            {INST.map(([ins, name]) => (
              <Fragment key={ins}>
                <span className="builder-label">{text(name)}</span>
                {bar.beats.map((beat, q) => (
                  <div className="cells" key={q}>
                    {parseBeat(beat).map((slot, s) => {
                      const mod = slot.get(ins);
                      return (
                        <button
                          type="button"
                          key={s}
                          aria-label={pick(`${name}, ${q + 1}. negyed, ${s + 1}. tag`, `${text(name)}, beat ${q + 1}, note ${s + 1}`)}
                          aria-pressed={mod !== undefined}
                          className={`cell${mod === undefined ? '' : ' on'}${mod === 'g' ? ' ghost' : ''}`}
                          onClick={() => cycle(b, q, s, ins)}
                        >
                          {mod === '>' ? '>' : mod === 'g' ? '( )' : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </Fragment>
            ))}
            <span className="builder-label">{pick('Kézrend', 'Sticking')}</span>
            {bar.beats.map((beat, q) => {
              const hands = (bar.hands?.[q] ?? '').trim().split(/\s+/);
              return (
                <div className="cells" key={q}>
                  {beat.trim().split(/\s+/).map((_, s) => (
                    <div className="hand" key={s}>
                      {['R', 'L'].map((side) => (
                        <button type="button" key={side} aria-pressed={hands[s] === side} className={`cell hand-btn${hands[s] === side ? ' on' : ''}`} onClick={() => setHand(b, q, s, side)}>
                          {side}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

interface ImageCodeProps {
  code: string;
  onCode: (code: string) => void;
  error: string;
  file: File | null;
  onFile: (file: File | null) => void;
}

/** Képről átírás: a kép az eredeti forrásként a tételhez kerül, mellette a kottakód adja a visszahallgatható kottát. */
function ImageCode({ code, onCode, error, file, onFile }: ImageCodeProps) {
  const { pick } = useI18n();
  const [preview, setPreview] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) return setPreview('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <section className="image-code">
      <button type="button" className="drop" onClick={() => input.current?.click()}>
        {preview ? <img src={preview} alt={pick('A feltöltött kotta', 'The uploaded score')} /> : file ? file.name : pick('+ Kép vagy PDF feltöltése', '+ Upload image or PDF')}
      </button>
      <input ref={input} hidden type="file" accept="image/*,application/pdf" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <label className="form">
        {pick('Kottakód (soronként egy ütem)', 'Score code (one bar per line)')}
        <textarea rows={5} spellCheck={false} className="code" value={code} onChange={(e) => onCode(e.target.value)} placeholder={'h+k h | h+s h | h+k h | h+s h\n@ R L | R L | R L | R L'} />
      </label>
      {error && <p className="error-box">{error}</p>}
      <p className="note-box">
        {pick('h hihat · o nyitott hihat · r ride · c crash · t kistam · u középtam · s pergő · f álló tam · k lábdob · - szünet · + egyszerre · (s) ghost · s> hangsúly. A kód nélkül mentett kép „átírásra vár” jelzést kap.', 'h hi-hat · o open hi-hat · r ride · c crash · t high tom · u mid tom · s snare · f floor tom · k kick · - rest · + together · (s) ghost · s> accent. An image saved without code is marked “awaiting transcription”.')}
      </p>
    </section>
  );
}
