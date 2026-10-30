import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Score, ScorePlayer } from '../components/Score';
import { TopBar } from '../components/TopBar';
import { exerciseList, findExercise, findSong, songPath } from '../data/catalog';
import { subdivisionOf, SUBDIVISIONS, toBeats, useLibrary, type ScoreBar, type Subdivision } from '../data/library';
import { KIND_LABEL, supabase, type LessonRow, type Material, type Profile } from '../lib/supabase';
import { SONGS } from '../songs';

const READY_LESSONS = 'kesz-orak';
const MISSING_COLUMNS = 'A mentéshez egyszer le kell futtatni a supabase/005_ora_tananyagbol.sql fájlt a Supabase SQL Editorban.';
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
  /** A tananyag eredeti képe: mentéskor a diák mappájába másolódik, hogy a diák is megnyithassa. */
  image?: string | null;
  fileName?: string | null;
  materialId?: string;
  filePath?: string | null;
  /** A régi, az óra sorába írt dobóra-hivatkozás. */
  doborak?: boolean;
}

interface Draft {
  date: string;
  title: string;
  notes: string;
  entries: Entry[];
}

const emptyDraft = (): Draft => ({ date: today(), title: '', notes: '', entries: [] });

function fromMaterial(m: Material): Entry {
  const song = m.kind === 'song' ? findSong(m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  return {
    key: m.kind === 'library' || song || ex ? `${m.kind}:${m.ref}` : `material:${m.id}`,
    kind: m.kind,
    ref: m.ref,
    title: m.title || song?.title || ex?.title || KIND_LABEL[m.kind],
    sub: song?.artist ?? m.note,
    bars: m.bars ?? undefined,
    bpm: m.bpm ?? undefined,
    fileName: m.file_name,
    materialId: m.id,
    filePath: m.file_path,
  };
}

/** Új óra összerakása vagy egy meglévő szerkesztése: a tananyagból böngészve kijelölt tételek és az összefoglaló.
 *  A böngészés az URL-ben van (?t=...), így a telefon vissza gombja is lépésenként visz vissza. */
export function LessonComposer() {
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
      const entries = ((m?.data as Material[]) ?? []).map(fromMaterial);
      if (dob) entries.unshift({ key: `exercise:${dob.ref}`, kind: 'exercise', ref: dob.ref, title: dob.title, sub: '', doborak: true });
      setSaved(entries);
      setDraft({ date: current.date, title: current.title, notes: current.notes, entries });
    });
  }, [id, lessonId, storageKey]);

  // Egy új óra piszkozata túléli, ha a telefon közben újratölti az oldalt.
  useEffect(() => {
    if (draft && !lessonId) sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, lessonId, storageKey]);

  const heading = number ? `${number}. óra` : 'Óra';
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
  const go = (t?: string) => {
    window.scrollTo(0, 0);
    nav(t ? `${base}?t=${encodeURIComponent(t)}` : base);
  };

  const save = async () => {
    if (!supabase || !draft || !number) return;
    if (!draft.entries.length && !draft.notes.trim()) return alert('Válassz tananyagot, vagy írj összefoglalót.');
    setBusy(true);
    const fail = (message: string) => {
      setBusy(false);
      alert(/bars|bpm|materials_kind_check/.test(message) ? MISSING_COLUMNS : message);
    };
    const row = {
      date: draft.date,
      title: draft.title.trim() || heading,
      notes: draft.notes.trim(),
      doborak: draft.entries.find((e) => e.doborak)?.ref ?? null,
    };
    const res = lesson
      ? await supabase.from('lessons').update(row).eq('id', lesson.id).select('id').single()
      : await supabase.from('lessons').insert({ ...row, student_id: id }).select('id').single();
    if (res.error) return fail(res.error.message);
    const savedId = (res.data as { id: string }).id;

    const added = draft.entries.filter((e) => !e.materialId && !e.doborak);
    const rows = [];
    for (const e of added) {
      let filePath: string | null = null;
      if (e.image) {
        filePath = `${id}/${Date.now()}-${e.image.split('/').pop()}`;
        const copy = await supabase.storage.from('materials').copy(e.image, filePath);
        if (copy.error) return fail(`A kottakép másolása nem sikerült: ${copy.error.message}`);
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
        file_path: filePath,
        file_name: filePath ? e.fileName ?? null : null,
      });
    }
    if (rows.length) {
      const { error } = await supabase.from('materials').insert(rows);
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
    if (!supabase || !lesson || !confirm('Törlöd ezt az órát? (A hozzá csatolt anyagok megmaradnak, csak az órához kötés szűnik meg.)')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
    if (error) return alert(error.message);
    nav(`/diak/${id}`, { replace: true });
  };

  const name = student?.full_name || 'Diák';
  if (!draft) {
    return (
      <>
        <TopBar title={heading} backTo={`/diak/${id}`} backLabel={name} />
        <main className="page">
          <p className="muted">{lessonId && number === null && student ? 'Ez az óra nem található.' : 'Betöltés…'}</p>
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
          {draft.entries.map((e) => (
            <EntryCard key={e.key} entry={e} onRemove={() => toggle(e)} />
          ))}
          <button className="add-tile composer-add" onClick={() => go('kategoriak')}>
            <span className="add-plus">+</span>
            <span className="item-tile-title">{draft.entries.length ? 'Még hozzáadok' : 'Tananyag hozzáadása'}</span>
          </button>
        </div>
        <div className="form composer-fields">
          <label>
            Dátum
            <input type="date" required value={draft.date} onChange={(e) => change({ date: e.target.value })} />
          </label>
          <label>
            Cím (nem kötelező)
            <input placeholder={heading} value={draft.title} onChange={(e) => change({ title: e.target.value })} />
          </label>
          <label className="composer-notes">
            Összefoglaló
            <textarea rows={3} placeholder="Mit vettünk, mire figyeljen…" value={draft.notes} onChange={(e) => change({ notes: e.target.value })} />
          </label>
        </div>
        <div className="composer-actions">
          {lesson && (
            <button className="btn ghost composer-delete" onClick={() => void removeLesson()}>
              Óra törlése
            </button>
          )}
          <Link className="btn" to={`/diak/${id}`}>
            Vissza
          </Link>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </main>
    </>
  );
}

function EntryCard({ entry: e, onRemove }: { entry: Entry; onRemove: () => void }) {
  const beats = useMemo(() => (e.bars ?? []).map(toBeats), [e.bars]);
  const [bpm, setBpm] = useState(e.bpm ?? 90);
  return (
    <article className="composer-card">
      <header>
        <div>
          <h3>{e.title}</h3>
          {e.sub && <p>{e.sub}</p>}
        </div>
        <button className="btn small ghost" aria-label={`Levétel: ${e.title}`} onClick={onRemove}>
          Levétel
        </button>
      </header>
      <div className="composer-card-body">
        {beats.length > 0 ? (
          <ScorePlayer id={`composer:${e.key}`} bars={beats} bpm={bpm} onBpm={setBpm} />
        ) : e.kind === 'song' && e.ref ? (
          <Link className="btn small primary" to={songPath(e.ref)}>
            Gyakorlás
          </Link>
        ) : e.kind === 'exercise' && e.ref ? (
          <Link className="btn small primary" to={`/lesson/${e.ref}`}>
            Megnyitás
          </Link>
        ) : (
          <p className="muted">{e.fileName || KIND_LABEL[e.kind]}</p>
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
  const { categories, items } = useLibrary();
  const [filter, setFilter] = useState<Subdivision | null>(null);
  const isPicked = (key: string) => picked.some((e) => e.key === key);
  const count = picked.length;

  const add = (
    <div className="composer-actions composer-sticky">
      <button className="btn" onClick={() => onOpen(cat === 'kategoriak' ? undefined : 'kategoriak')}>
        Vissza
      </button>
      <button className="btn primary" onClick={() => onOpen()}>
        Hozzáadás {name.split(/\s+/).pop()} órájához{count ? ` (${count})` : ''}
      </button>
    </div>
  );

  if (cat === 'kategoriak') {
    const all = [...categories, { id: READY_LESSONS, name: 'Kész órák' }];
    const size = (id: string) =>
      id === 'dalok' ? SONGS.length : id === READY_LESSONS ? exerciseList.length : items.filter((i) => i.category === id).length;
    return (
      <>
        <TopBar title="Tananyag" backTo={base} backLabel={heading} />
        <main className="page">
          <div className="tile-grid">
            {all.map((c, i) => (
              <button key={c.id} className={`cat-tile tone-${(i + (i >> 1)) % 2}`} onClick={() => onOpen(c.id)}>
                <span className="cat-tile-name">{c.name}</span>
                <span className="cat-tile-sub">{size(c.id) ? `${size(c.id)} tétel` : 'még üres'}</span>
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
      ? SONGS.map((s) => ({ key: `song:${s.id}`, kind: 'song', ref: s.id, title: s.title, sub: s.artist }))
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
            image: i.image_path,
            fileName: i.file_name,
            preview: i.bars[0],
          }));
  const title = cat === READY_LESSONS ? 'Kész órák' : categories.find((c) => c.id === cat)?.name ?? 'Tananyag';
  const kinds = new Set(library.map((i) => subdivisionOf(i.bars)));
  const offered = SUBDIVISIONS.filter(([s]) => s !== 'triolas' || kinds.has(s));

  return (
    <>
      <TopBar title={title} backTo={`${base}?t=kategoriak`} backLabel="Tananyag" />
      <main className="page">
        {library.length > 0 && (
          <nav className="filters" aria-label="Szűrők">
            <span>Szűrők:</span>
            <button className={filter ? '' : 'on'} onClick={() => setFilter(null)}>
              Mind
            </button>
            {offered.map(([s, label]) => (
              <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
                {label}
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
                  <span className="item-tile-title">{e.title}</span>
                  {e.sub && <span className="item-tile-sub">{e.sub}</span>}
                  {e.preview && <Score bars={[toBeats(e.preview)]} />}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="muted">{library.length ? 'Ehhez a szűrőhöz nincs tétel.' : 'Ez a kategória még üres.'}</p>
        )}
        {add}
      </main>
    </>
  );
}
