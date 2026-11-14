import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClipPlayer, StoredClipPlayer } from '../components/ClipPlayer';
import { Score, ScorePlayer } from '../components/Score';
import { Sortable } from '../components/Sortable';
import { TopBar } from '../components/TopBar';
import { exerciseList, findExercise, songPath } from '../data/catalog';
import { subdivisionOf, SUBDIVISIONS, toBeats, useLibrary, type ScoreBar, type Subdivision } from '../data/library';
import { useI18n } from '../i18n';
import { inLessonOrder, KIND_LABEL, supabase, type LessonRow, type Material, type Profile } from '../lib/supabase';
import { findSong, playable, useSongs, type SongRow } from '../songs/store';
import { findClip, type ClipRef } from '../songs/clips';

const READY_LESSONS = 'kesz-orak';
const today = () => new Date().toISOString().slice(0, 10);

/** Egy tétel az órán: a tananyagból most választott, vagy a már elmentett anyag (materialId). */
interface Entry {
  key: string;
  kind: Material['kind'];
  ref: string | null;
  title: string;
  sub: string;
  bars?: ScoreBar[];
  bpm?: number;
  bpmMin?: number | null;
  bpmMax?: number | null;
  /** A tananyag eredeti képe: mentéskor a diák mappájába másolódik, hogy a diák is megnyithassa. */
  image?: string | null;
  clip?: ClipRef | null;
  fileName?: string | null;
  materialId?: string;
  position?: number | null;
  filePath?: string | null;
  /** A régi, az óra sorába írt dobóra-hivatkozás. */
  doborak?: boolean;
}

interface Draft {
  date: string;
  title: string;
  notes: string;
  /** a diák még nem nyithatja meg */
  locked?: boolean;
  entries: Entry[];
}

const emptyDraft = (): Draft => ({ date: today(), title: '', notes: '', entries: [] });

function fromMaterial(m: Material, songs: SongRow[] | null): Entry {
  const song = m.kind === 'song' ? findSong(songs, m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  return {
    key: m.kind === 'library' || song || ex ? `${m.kind}:${m.ref}` : `material:${m.id}`,
    kind: m.kind,
    ref: m.ref,
    title: m.title || song?.title || ex?.title || KIND_LABEL[m.kind],
    sub: song?.artist ?? m.note,
    bars: m.bars ?? undefined,
    bpm: m.bpm ?? undefined,
    bpmMin: m.bpm_min ?? null,
    bpmMax: m.bpm_max ?? null,
    clip: m.clip ?? null,
    fileName: m.file_name,
    materialId: m.id,
    position: m.position,
    filePath: m.file_path,
  };
}

/** Új óra összerakása vagy egy meglévő szerkesztése: a tananyagból böngészve kijelölt tételek és az összefoglaló.
 *  A böngészés az URL-ben van (?t=...), így a telefon vissza gombja is lépésenként visz vissza. */
export function LessonComposer() {
  const { t, pick, text } = useI18n();
  const songRows = useSongs();
  const { id = '', lessonId } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const browsing = params.get('t');
  const base = lessonId ? `/diak/${id}/ora/${lessonId}` : `/diak/${id}/uj-ora`;
  const storageKey = `lesson-draft:${id}`;

  const [student, setStudent] = useState<Profile | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [saved, setSaved] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('lessons').select('*').eq('student_id', id).order('date').order('created_at'),
      lessonId ? supabase.from('materials').select('*').eq('lesson_id', lessonId).order('created_at') : null,
    ]).then(([p, l, m]) => {
      const all = (l.data as LessonRow[]) ?? [];
      setStudent((p.data as Profile) ?? null);
      if (!lessonId) {
        setNumber(all.length + 1);
        let stored: Draft | null = null;
        try {
          stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Draft | null;
        } catch {
          stored = null;
        }
        setDraft(stored ?? emptyDraft());
        return;
      }
      const current = all.find((x) => x.id === lessonId) ?? null;
      setLesson(current);
      setNumber(current ? all.indexOf(current) + 1 : null);
      if (!current) return;
      const dob = findExercise(current.doborak);
      const entries = inLessonOrder((m?.data as Material[]) ?? []).map((x) => fromMaterial(x, songRows));
      if (dob) entries.unshift({ key: `exercise:${dob.ref}`, kind: 'exercise', ref: dob.ref, title: dob.title, sub: '', doborak: true });
      setSaved(entries);
      setDraft({ date: current.date, title: current.title, notes: current.notes, locked: !!current.locked, entries });
    });
  }, [id, lessonId, storageKey]);

  // Egy új óra piszkozata túléli, ha a telefon közben újratölti az oldalt.
  useEffect(() => {
    if (draft && !lessonId) sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, lessonId, storageKey]);

  const heading = number ? t.lessonN(number) : pick('Óra', 'Lesson');
  const change = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const toggle = (entry: Entry) =>
    setDraft((d) =>
      d && {
        ...d,
        entries: d.entries.some((e) => e.key === entry.key)
          ? d.entries.filter((e) => e.key !== entry.key)
          : [...d.entries, entry],
      },
    );
  const moveEntry = (from: number, to: number) =>
    setDraft((d) => {
      if (!d) return d;
      const entries = [...d.entries];
      entries.splice(to, 0, ...entries.splice(from, 1));
      return { ...d, entries };
    });
  const go = (t?: string) => {
    window.scrollTo(0, 0);
    nav(t ? `${base}?t=${encodeURIComponent(t)}` : base);
  };

  const save = async () => {
    if (!supabase || !draft || !number) return;
    if (!draft.entries.length && !draft.notes.trim()) return alert(pick('Válassz tananyagot, vagy írj összefoglalót.', 'Choose library items or write a summary.'));
    setBusy(true);
    const fail = (message: string) => {
      setBusy(false);
      alert(/position/.test(message) ? pick('A mentéshez egyszer le kell futtatni a supabase/007_anyag_sorrend.sql fájlt a Supabase SQL Editorban.', 'To save, run supabase/007_anyag_sorrend.sql once in the Supabase SQL Editor.') : /bars|bpm|materials_kind_check/.test(message) ? pick('A mentéshez egyszer le kell futtatni a supabase/005_ora_tananyagbol.sql fájlt a Supabase SQL Editorban.', 'To save, run supabase/005_ora_tananyagbol.sql once in the Supabase SQL Editor.') : message);
    };
    const row = {
      date: draft.date,
      // magyarul mentve: megjelenítéskor a text() a nézet nyelvére fordítja
      title: draft.title.trim() || `${number}. óra`,
      notes: draft.notes.trim(),
      doborak: draft.entries.find((e) => e.doborak)?.ref ?? null,
      locked: !!draft.locked,
    };
    const res = lesson
      ? await supabase.from('lessons').update(row).eq('id', lesson.id).select('id').single()
      : await supabase.from('lessons').insert({ ...row, student_id: id }).select('id').single();
    if (res.error) return fail(res.error.message);
    const savedId = (res.data as { id: string }).id;

    // a kész óra nem anyag: a diák oldalán mindig az első, a sorrendbe nem számít bele
    const ordered = draft.entries.filter((e) => !e.doborak);
    const added = ordered.filter((e) => !e.materialId);
    const rows = [];
    for (const e of added) {
      let filePath: string | null = null;
      if (e.image) {
        filePath = `${id}/${Date.now()}-${e.image.split('/').pop()}`;
        const copy = await supabase.storage.from('materials').copy(e.image, filePath);
        if (copy.error) return fail(`${pick('A kottakép másolása nem sikerült', 'Copying the sheet image failed')}: ${copy.error.message}`);
      }
      rows.push({
        student_id: id,
        lesson_id: savedId,
        kind: e.kind,
        title: e.title,
        ref: e.ref,
        note: e.kind === 'library' ? e.sub : '',
        bars: e.bars ?? null,
        bpm: e.bpm ?? null,
        ...(e.bpmMin || e.bpmMax ? { bpm_min: e.bpmMin ?? null, bpm_max: e.bpmMax ?? null } : {}),
        ...(e.clip ? { clip: e.clip } : {}),
        position: ordered.indexOf(e),
        file_path: filePath,
        file_name: filePath ? e.fileName ?? null : null,
      });
    }
    if (rows.length) {
      const { error } = await supabase.from('materials').insert(rows);
      if (error) return fail(error.message);
    }
    for (const [position, e] of ordered.entries()) {
      if (!e.materialId || e.position === position) continue;
      const { error } = await supabase.from('materials').update({ position }).eq('id', e.materialId);
      if (error) return fail(error.message);
    }

    const removed = saved.filter((s) => s.materialId && !draft.entries.some((e) => e.key === s.key));
    const files = removed.flatMap((r) => (r.filePath ? [r.filePath] : []));
    if (files.length) await supabase.storage.from('materials').remove(files);
    if (removed.length) {
      const { error } = await supabase.from('materials').delete().in('id', removed.map((r) => r.materialId!));
      if (error) return fail(error.message);
    }

    if (!lesson) sessionStorage.removeItem(storageKey);
    nav(`/diak/${id}`, { replace: true });
  };

  const removeLesson = async () => {
    if (!supabase || !lesson || !confirm(pick('Törlöd ezt az órát? (A hozzá csatolt anyagok megmaradnak, csak az órához kötés szűnik meg.)', 'Delete this lesson? (Its materials stay, they are just no longer tied to the lesson.)'))) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
    if (error) return alert(error.message);
    nav(`/diak/${id}`, { replace: true });
  };

  const name = student?.full_name || pick('Diák', 'Student');
  if (!draft) {
    return (
      <>
        <TopBar title={heading} backTo={`/diak/${id}`} backLabel={name} />
        <main className="page">
          <p className="muted">{lessonId && number === null && student ? t.lessonMissing : pick('Betöltés…', 'Loading…')}</p>
        </main>
      </>
    );
  }

  if (browsing) {
    return (
      <Browser
        cat={browsing}
        name={name}
        heading={heading}
        base={base}
        picked={draft.entries}
        onToggle={toggle}
        onOpen={go}
      />
    );
  }

  return (
    <>
      <TopBar title={heading} backTo={`/diak/${id}`} backLabel={name} />
      <main className="page">
        <div className="composer-grid">
          <Sortable items={draft.entries} keyOf={(e) => e.key} onMove={moveEntry}>
            {(e, move) => <EntryCard entry={e} onRemove={() => toggle(e)} onMove={move} />}
          </Sortable>
          <button className="add-tile composer-add" onClick={() => go('kategoriak')}>
            <span className="add-plus">+</span>
            <span className="item-tile-title">{draft.entries.length ? pick('Még hozzáadok', 'Add more') : pick('Tananyag hozzáadása', 'Add from library')}</span>
          </button>
        </div>
        <div className="form composer-fields">
          <label>
            {pick('Dátum', 'Date')}
            <input type="date" required value={draft.date} onChange={(e) => change({ date: e.target.value })} />
          </label>
          <label>
            {pick('Cím (nem kötelező)', 'Title (optional)')}
            <input placeholder={heading} value={text(draft.title)} onChange={(e) => change({ title: e.target.value })} />
          </label>
          <label className="composer-notes">
            {pick('Összefoglaló', 'Summary')}
            <textarea rows={3} placeholder={pick('Mit vettünk, mire figyeljen…', 'What we covered, what to watch for…')} value={draft.notes} onChange={(e) => change({ notes: e.target.value })} />
          </label>
          <label className="composer-lock">
            <input type="checkbox" checked={!!draft.locked} onChange={(e) => change({ locked: e.target.checked })} />
            {pick('Zárolva: a diák látja, de még nem nyithatja meg', 'Locked: the student sees it but cannot open it yet')}
          </label>
        </div>
        <div className="composer-actions">
          {lesson && (
            <button className="btn ghost composer-delete" onClick={() => void removeLesson()}>
              {pick('Óra törlése', 'Delete lesson')}
            </button>
          )}
          <Link className="btn" to={`/diak/${id}`}>
            {t.back}
          </Link>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>
            {busy ? pick('Mentés…', 'Saving…') : pick('Mentés', 'Save')}
          </button>
        </div>
      </main>
    </>
  );
}

function EntryCard({ entry: e, onRemove, onMove }: { entry: Entry; onRemove: () => void; onMove: (delta: number) => void }) {
  const { pick, text } = useI18n();
  const beats = useMemo(() => (e.bars ?? []).map(toBeats), [e.bars]);
  const [bpm, setBpm] = useState(e.bpm ?? 90);
  const clip = e.kind === 'library' ? findClip(e.ref) : undefined;
  return (
    <article className="composer-card">
      <header>
        <button
          type="button"
          className="grip"
          aria-label={`${pick('Áthelyezés a nyilakkal', 'Move with the arrow keys')}: ${text(e.title)}`}
          onKeyDown={(k) => {
            const delta = k.key === 'ArrowLeft' || k.key === 'ArrowUp' ? -1 : k.key === 'ArrowRight' || k.key === 'ArrowDown' ? 1 : 0;
            if (!delta) return;
            k.preventDefault();
            onMove(delta);
          }}
        >
          <svg width="14" height="22" viewBox="0 0 14 22" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="2" /><circle cx="11" cy="3" r="2" />
            <circle cx="3" cy="11" r="2" /><circle cx="11" cy="11" r="2" />
            <circle cx="3" cy="19" r="2" /><circle cx="11" cy="19" r="2" />
          </svg>
        </button>
        <div>
          <h3>{text(e.title)}</h3>
          {e.sub && <p>{text(e.sub)}</p>}
        </div>
        <button className="btn small ghost" aria-label={`${pick('Levétel', 'Remove')}: ${text(e.title)}`} onClick={onRemove}>
          {pick('Levétel', 'Remove')}
        </button>
      </header>
      <div className="composer-card-body">
        {e.clip ? (
          <StoredClipPlayer clip={e.clip} title={text(e.title)} bpm={e.bpm ?? 90} main={beats} />
        ) : clip ? (
          <ClipPlayer clip={clip} />
        ) : beats.length > 0 ? (
          <ScorePlayer id={`composer:${e.key}`} bars={beats} bpm={bpm} onBpm={setBpm} min={e.bpmMin} max={e.bpmMax} />
        ) : e.kind === 'song' && e.ref ? (
          <Link className="btn small primary" to={songPath(e.ref)}>
            {pick('Gyakorlás', 'Practice')}
          </Link>
        ) : e.kind === 'exercise' && e.ref ? (
          <Link className="btn small primary" to={`/lesson/${e.ref}`}>
            {pick('Megnyitás', 'Open')}
          </Link>
        ) : (
          <p className="muted">{e.fileName || text(KIND_LABEL[e.kind])}</p>
        )}
      </div>
    </article>
  );
}

interface BrowserProps {
  cat: string;
  name: string;
  heading: string;
  base: string;
  picked: Entry[];
  onToggle: (e: Entry) => void;
  onOpen: (t?: string) => void;
}

/** A tananyag böngészése egy óra számára: előbb a kategóriák, aztán a tételek, kipipálva. */
function Browser({ cat, name, heading, base, picked, onToggle, onOpen }: BrowserProps) {
  const { t, pick, text } = useI18n();
  const { categories, items } = useLibrary();
  const songs = playable(useSongs());
  const [filter, setFilter] = useState<Subdivision | null>(null);
  const isPicked = (key: string) => picked.some((e) => e.key === key);
  const count = picked.length;

  const add = (
    <div className="composer-actions composer-sticky">
      <button className="btn" onClick={() => onOpen(cat === 'kategoriak' ? undefined : 'kategoriak')}>
        {t.back}
      </button>
      <button className="btn primary" onClick={() => onOpen()}>
        {pick(`Hozzáadás ${name.split(/\s+/).pop()} órájához`, `Add to ${name.split(/\s+/).pop()}'s lesson`)}{count ? ` (${count})` : ''}
      </button>
    </div>
  );

  if (cat === 'kategoriak') {
    const all = [...categories, { id: READY_LESSONS, name: 'Kész órák' }];
    const size = (id: string) =>
      id === 'dalok' ? songs.length + items.filter((i) => i.category === id).length : id === READY_LESSONS ? exerciseList.length : items.filter((i) => i.category === id).length;
    return (
      <>
        <TopBar title={pick('Tananyag', 'Library')} backTo={base} backLabel={heading} />
        <main className="page">
          <div className="tile-grid">
            {all.map((c, i) => (
              <button key={c.id} className={`cat-tile tone-${(i + (i >> 1)) % 2}`} onClick={() => onOpen(c.id)}>
                <span className="cat-tile-name">{c.id === READY_LESSONS ? pick('Kész órák', 'Ready-made lessons') : text(c.name)}</span>
                <span className="cat-tile-sub">{size(c.id) ? pick(`${size(c.id)} tétel`, `${size(c.id)} ${size(c.id) === 1 ? 'item' : 'items'}`) : pick('még üres', 'empty')}</span>
              </button>
            ))}
          </div>
          {add}
        </main>
      </>
    );
  }

  const library = items.filter((i) => i.category === cat);
  const shown = filter ? library.filter((i) => subdivisionOf(i.bars) === filter) : library;
  const entries: (Entry & { preview?: ScoreBar })[] =
    cat === 'dalok'
      ? [
          ...songs.map((s) => ({ key: `song:${s.id}`, kind: 'song' as const, ref: s.id, title: s.title, sub: s.artist })),
          // a dalokhoz tartozó gyakorlatok (pl. szólambontás): tananyag-tételként kerülnek az órába
          ...library.map((i) => ({ key: `library:${i.category}/${i.id}`, kind: 'library' as const, ref: `${i.category}/${i.id}`, title: i.title, sub: i.subtitle, bars: i.bars, bpm: i.bpm, preview: i.bars[0] })),
        ]
      : cat === READY_LESSONS
        ? exerciseList.map((x) => ({ key: `exercise:${x.ref}`, kind: 'exercise', ref: x.ref, title: x.title, sub: `${x.bpm} BPM` }))
        : shown.map((i) => ({
            key: `library:${i.category}/${i.id}`,
            kind: 'library',
            ref: `${i.category}/${i.id}`,
            title: i.title,
            sub: i.subtitle,
            bars: i.bars,
            bpm: i.bpm,
            bpmMin: i.bpm_min ?? null,
            bpmMax: i.bpm_max ?? null,
            image: i.image_path,
            clip: i.clip ?? null,
            fileName: i.file_name,
            preview: i.bars[0],
          }));
  const title = cat === READY_LESSONS ? pick('Kész órák', 'Ready-made lessons') : text(categories.find((c) => c.id === cat)?.name ?? 'Tananyag');
  const kinds = new Set(library.map((i) => subdivisionOf(i.bars)));
  const offered = SUBDIVISIONS.filter(([s]) => s !== 'triolas' || kinds.has(s));

  return (
    <>
      <TopBar title={title} backTo={`${base}?t=kategoriak`} backLabel={pick('Tananyag', 'Library')} />
      <main className="page">
        {cat !== 'dalok' && library.some((i) => i.bars.length > 0) && (
          <nav className="filters" aria-label={pick('Szűrők', 'Filters')}>
            <span>{pick('Szűrők:', 'Filters:')}</span>
            <button className={filter ? '' : 'on'} onClick={() => setFilter(null)}>
              {pick('Mind', 'All')}
            </button>
            {offered.map(([s, label]) => (
              <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
                {text(label)}
              </button>
            ))}
          </nav>
        )}
        {entries.length ? (
          <div className="item-grid">
            {entries.map((e, i) => {
              const on = isPicked(e.key);
              return (
                <label key={e.key} className={`item-tile pick-tile tone-${i % 2}${on ? ' picked' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => onToggle(e)} />
                  <span className="pick-mark" aria-hidden="true" />
                  <span className="item-tile-title">{text(e.title)}</span>
                  {e.sub && <span className="item-tile-sub">{text(e.sub)}</span>}
                  {e.preview && <Score bars={[toBeats(e.preview)]} />}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="muted">{library.length ? pick('Ehhez a szűrőhöz nincs tétel.', 'Nothing matches this filter.') : pick('Ez a kategória még üres.', 'This category is still empty.')}</p>
        )}
        {add}
      </main>
    </>
  );
}
