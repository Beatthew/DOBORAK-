import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { MaterialCard } from '../components/MaterialCard';
import { TopBar } from '../components/TopBar';
import { exerciseList, songList } from '../data/catalog';
import { KIND_LABEL, supabase, type Kind, type LessonRow, type Material, type Profile } from '../lib/supabase';
import { LessonsList } from './StudentHome';

type Tab = 'lessons' | 'songs' | 'exercises';
const TABS: [Tab, string][] = [
  ['lessons', 'Órák'],
  ['songs', 'Dalok'],
  ['exercises', 'Gyakorlatok'],
];
const today = () => new Date().toISOString().slice(0, 10);

/** Egy diák a tanár szemével: órái, kiadott dalai és gyakorlatai + új óra rögzítése és anyag kiadása. */
export function TeacherStudent() {
  const { id = '' } = useParams();
  const [student, setStudent] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tab, setTab] = useState<Tab>('lessons');
  const [form, setForm] = useState<'lesson' | 'material' | null>(null);
  const [editing, setEditing] = useState<LessonRow | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [p, l, m] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('lessons').select('*').eq('student_id', id).order('date', { ascending: false }),
      supabase.from('materials').select('*').eq('student_id', id).order('created_at', { ascending: false }),
    ]);
    setStudent((p.data as Profile) ?? null);
    setLessons((l.data as LessonRow[]) ?? []);
    setMaterials((m.data as Material[]) ?? []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const del = async (m: Material) => {
    if (!supabase || !confirm(`Törlöd: ${m.title || KIND_LABEL[m.kind]}?`)) return;
    if (m.file_path) await supabase.storage.from('materials').remove([m.file_path]);
    await supabase.from('materials').delete().eq('id', m.id);
    void load();
  };
  const done = () => {
    setForm(null);
    setEditing(null);
    void load();
  };
  const edit = (l: LessonRow) => {
    setEditing(l);
    setForm('lesson');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const listed = materials.filter((m) => m.kind === (tab === 'songs' ? 'song' : 'exercise'));

  return (
    <>
      <TopBar title={student?.full_name || 'Diák'} backTo="/" backLabel="Diákjaim">
        <nav className="tabs">
          {TABS.map(([t, label]) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>
      </TopBar>
      <main className="page">
        <div className="row">
          <button
            className="btn primary"
            onClick={() => {
              setEditing(null);
              setForm(form === 'lesson' && !editing ? null : 'lesson');
            }}
          >
            + Új óra
          </button>
          <button className="btn primary" onClick={() => setForm(form === 'material' ? null : 'material')}>
            + Anyag kiadása
          </button>
        </div>
        {form === 'lesson' && <LessonForm key={editing?.id ?? 'new'} studentId={id} lesson={editing} onDone={done} />}
        {form === 'material' && (
          <MaterialForm
            studentId={id}
            lessons={lessons}
            initialKind={tab === 'songs' ? 'song' : tab === 'exercises' ? 'exercise' : 'material'}
            onDone={done}
          />
        )}
        {tab === 'lessons' ? (
          <LessonsList lessons={lessons} materials={materials} onDelete={(m) => void del(m)} onEdit={edit} />
        ) : listed.length ? (
          <div className="grid">
            {listed.map((m) => (
              <MaterialCard key={m.id} m={m} onDelete={() => void del(m)} />
            ))}
          </div>
        ) : (
          <p className="muted">Még nincs kiadva semmi.</p>
        )}
      </main>
    </>
  );
}

/** Új óra, vagy (lesson megadásával) egy meglévő szerkesztése / törlése. Az órához köthető egy dobórák-óra is. */
function LessonForm({ studentId, lesson, onDone }: { studentId: string; lesson: LessonRow | null; onDone: () => void }) {
  const [date, setDate] = useState(lesson?.date ?? today());
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [notes, setNotes] = useState(lesson?.notes ?? '');
  const [doborak, setDoborak] = useState(lesson?.doborak ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const row = { date, title: title.trim(), notes: notes.trim(), doborak: doborak || null };
    const { error } = lesson
      ? await supabase.from('lessons').update(row).eq('id', lesson.id)
      : await supabase.from('lessons').insert({ ...row, student_id: studentId });
    setBusy(false);
    if (error) return alert(error.message);
    onDone();
  };

  const remove = async () => {
    if (!supabase || !lesson || !confirm('Törlöd ezt az órát? (A hozzá csatolt anyagok megmaradnak, csak az órához kötés szűnik meg.)')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
    if (error) return alert(error.message);
    onDone();
  };

  return (
    <form className="form card" onSubmit={submit}>
      <label>
        Dátum
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Cím
        <input placeholder="pl. Shuffle groove, első fillek" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Dobóra ehhez az órához
        <select value={doborak} onChange={(e) => setDoborak(e.target.value)}>
          <option value="">– nincs –</option>
          {exerciseList.map((x) => (
            <option key={x.ref} value={x.ref}>
              {x.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Jegyzet
        <textarea rows={3} placeholder="Mit vettünk, mire figyeljen…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Mentés…' : lesson ? 'Változások mentése' : 'Óra mentése'}
      </button>
      {lesson && (
        <button type="button" className="btn ghost" onClick={() => void remove()}>
          Óra törlése
        </button>
      )}
    </form>
  );
}

interface MaterialFormProps {
  studentId: string;
  lessons: LessonRow[];
  initialKind: Kind;
  onDone: () => void;
}

function MaterialForm({ studentId, lessons, initialKind, onDone }: MaterialFormProps) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? '');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (kind === 'song' && !ref) return alert('Válassz dalt.');
    if (kind !== 'song' && !ref && !file && !link.trim() && !note.trim() && !title.trim())
      return alert('Adj meg legalább egy fájlt, linket vagy jegyzetet.');
    setBusy(true);
    let filePath: string | null = null;
    if (file) {
      // a diák mappájába: a tárhely jogosultsága a mappanév (diák id) alapján enged olvasni
      const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      filePath = `${studentId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from('materials').upload(filePath, file, { contentType: file.type || undefined });
      if (up.error) {
        setBusy(false);
        return alert(`A feltöltés nem sikerült: ${up.error.message}`);
      }
    }
    const { error } = await supabase.from('materials').insert({
      student_id: studentId,
      lesson_id: lessonId || null,
      kind,
      title: title.trim(),
      ref: ref || null,
      file_path: filePath,
      file_name: file?.name ?? null,
      link_url: link.trim() || null,
      note: note.trim(),
    });
    setBusy(false);
    if (error) return alert(error.message);
    onDone();
  };

  return (
    <form className="form card" onSubmit={submit}>
      <div className="seg">
        {(['material', 'song', 'exercise'] as Kind[]).map((k) => (
          <button
            type="button"
            key={k}
            className={k === kind ? 'on' : ''}
            onClick={() => {
              setKind(k);
              setRef('');
            }}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {kind === 'song' && (
        <label>
          Dal
          <select required value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">– válassz –</option>
            {songList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.artist ? ` – ${s.artist}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'exercise' && (
        <label>
          Dobóra (vagy saját gyakorlat fájlként lent)
          <select value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">– nincs, saját fájl / jegyzet –</option>
            {exerciseList.map((x) => (
              <option key={x.ref} value={x.ref}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Cím{kind === 'song' ? ' (nem kötelező)' : ''}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'material' ? 'pl. Órai kotta, házi feladat' : ''} />
      </label>
      <label>
        Melyik órához
        <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          <option value="">– egyikhez sem –</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {new Date(l.date).toLocaleDateString('hu-HU')} · {l.title || 'Óra'}
            </option>
          ))}
        </select>
      </label>
      {kind !== 'song' && (
        <label>
          Fájl (kotta, hang, videó…)
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      <label>
        Link (pl. YouTube)
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </label>
      <label>
        Megjegyzés
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="pl. 80 BPM-ről indulj, a fillre figyelj" />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Mentés…' : 'Kiadás a diáknak'}
      </button>
    </form>
  );
}
