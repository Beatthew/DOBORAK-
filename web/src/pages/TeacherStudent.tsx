import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MaterialCard } from '../components/MaterialCard';
import { TopBar } from '../components/TopBar';
import { TuitionTracker } from '../components/TuitionTracker';
import { exerciseList } from '../data/catalog';
import { playable, useSongs } from '../songs/store';
import { useI18n } from '../i18n';
import { KIND_LABEL, supabase, type Kind, type LessonRow, type Material, type Profile } from '../lib/supabase';
import { LessonsList } from './StudentHome';

type Tab = 'lessons' | 'songs' | 'exercises' | 'finance';
const TABS: [Tab, string, string][] = [
  ['lessons', 'Órák', 'Lessons'],
  ['songs', 'Dalok', 'Songs'],
  ['exercises', 'Gyakorlatok', 'Exercises'],
  ['finance', 'Pénzügyek', 'Finances'],
];

/** Egy diák a tanár szemével: órái, kiadott dalai és gyakorlatai + új óra (LessonComposer) és fájl kiadása, külön fülön a tandíja. */
export function TeacherStudent() {
  const { pick, text } = useI18n();
  const { id = '' } = useParams();
  const [student, setStudent] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tab, setTab] = useState<Tab>('lessons');
  const [form, setForm] = useState<'material' | null>(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    if (!supabase) return;
    const [p, l, m] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('lessons').select('*').eq('student_id', id).order('date', { ascending: false }).order('created_at', { ascending: false }),
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
    if (!supabase || !confirm(`${pick('Törlöd', 'Delete')}: ${text(m.title || KIND_LABEL[m.kind])}?`)) return;
    if (m.file_path) await supabase.storage.from('materials').remove([m.file_path]);
    await supabase.from('materials').delete().eq('id', m.id);
    void load();
  };
  const done = () => {
    setForm(null);
    void load();
  };
  // ami egy órához van csatolva, az az óra alatt látszik; a Gyakorlatok fülön csak a külön kiadott gyakorlatok
  const listed = materials.filter((m) => (tab === 'songs' ? m.kind === 'song' : m.kind === 'exercise' && !m.lesson_id));

  return (
    <>
      <TopBar title={student?.full_name || pick('Diák', 'Student')} backTo="/diakok" backLabel={pick('Diákjaim', 'My students')}>
        <nav className="tabs four">
          {TABS.map(([t, huLabel, enLabel]) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
              {pick(huLabel, enLabel)}
            </button>
          ))}
        </nav>
      </TopBar>
      <main className="page">
        {tab === 'finance' ? (
          <TuitionTracker studentId={id} />
        ) : (
          <>
            {student && !student.user_id && <StudentEmail student={student} onSaved={() => void load()} />}
            {form && (
              <MaterialForm
                studentId={id}
                lessons={lessons}
                initialKind={tab === 'songs' ? 'song' : tab === 'exercises' ? 'exercise' : 'material'}
                onDone={done}
              />
            )}
            {tab === 'lessons' ? (
              <>
                <LessonsList
                  lessons={lessons}
                  materials={materials}
                  onDelete={(m) => void del(m)}
                  onEdit={(l) => nav(`/diak/${id}/ora/${l.id}`)}
                  back={`/diak/${id}`}
                  ascending
                />
                <Link className="add-tile composer-add" to={`/diak/${id}/uj-ora`}>
                  <span className="add-plus">+</span>
                  <span className="item-tile-title">{pick('Új óra', 'New lesson')}</span>
                </Link>
              </>
            ) : listed.length ? (
              <div className="grid">
                {listed.map((m) => (
                  <MaterialCard key={m.id} m={m} onDelete={() => void del(m)} />
                ))}
              </div>
            ) : (
              <p className="muted">{pick('Még nincs kiadva semmi.', 'Nothing assigned yet.')}</p>
            )}
            <button className="btn ghost big" onClick={() => setForm(form ? null : 'material')}>
              {pick('+ Fájl vagy link kiadása', '+ Assign a file or link')}
            </button>
          </>
        )}
      </main>
    </>
  );
}

/** A még nem regisztrált diák email címe: ezzel a címmel regisztrálva kapcsolódik a fiókja ehhez a profilhoz. */
function StudentEmail({ student, onSaved }: { student: Profile; onSaved: () => void }) {
  const { pick } = useI18n();
  const [email, setEmail] = useState(student.email);
  const [busy, setBusy] = useState(false);
  const value = email.trim().toLowerCase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ email: value }).eq('id', student.id);
    setBusy(false);
    if (error) return alert(/duplicate|unique/i.test(error.message) ? pick('Ezzel az email címmel már van diák.', 'There is already a student with this email.') : error.message);
    onSaved();
  };

  return (
    <form className="form card" onSubmit={submit}>
      <label>
        {pick('Email (ezzel fog regisztrálni)', 'Email (they will sign up with this)')}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy || value === student.email}>
        {busy ? pick('Mentés…', 'Saving…') : pick('Email mentése', 'Save email')}
      </button>
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
  const songList = playable(useSongs());
  const { pick, text, locale } = useI18n();
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
    if (kind === 'song' && !ref) return alert(pick('Válassz dalt.', 'Choose a song.'));
    if (kind !== 'song' && !ref && !file && !link.trim() && !note.trim() && !title.trim())
      return alert(pick('Adj meg legalább egy fájlt, linket vagy jegyzetet.', 'Add at least a file, a link or a note.'));
    setBusy(true);
    let filePath: string | null = null;
    if (file) {
      // a diák mappájába: a tárhely jogosultsága a mappanév (diák id) alapján enged olvasni
      const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      filePath = `${studentId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from('materials').upload(filePath, file, { contentType: file.type || undefined });
      if (up.error) {
        setBusy(false);
        return alert(`${pick('A feltöltés nem sikerült', 'Upload failed')}: ${up.error.message}`);
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
            {text(KIND_LABEL[k])}
          </button>
        ))}
      </div>
      {kind === 'song' && (
        <label>
          {pick('Dal', 'Song')}
          <select required value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">{pick('– válassz –', '– choose –')}</option>
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
          {pick('Kész óra (vagy saját gyakorlat fájlként lent)', 'Ready-made lesson (or your own exercise as a file below)')}
          <select value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">{pick('– nincs, saját fájl / jegyzet –', '– none, own file / note –')}</option>
            {exerciseList.map((x) => (
              <option key={x.ref} value={x.ref}>
                {text(x.title)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {pick('Cím', 'Title')}{kind === 'song' ? pick(' (nem kötelező)', ' (optional)') : ''}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'material' ? pick('pl. Órai kotta, házi feladat', 'e.g. Lesson sheet, homework') : ''} />
      </label>
      <label>
        {pick('Melyik órához', 'For which lesson')}
        <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          <option value="">{pick('– egyikhez sem –', '– none –')}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {new Date(l.date).toLocaleDateString(locale)} · {text(l.title) || pick('Óra', 'Lesson')}
            </option>
          ))}
        </select>
      </label>
      {kind !== 'song' && (
        <label>
          {pick('Fájl (kotta, hang, videó…)', 'File (sheet, audio, video…)')}
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      <label>
        {pick('Link (pl. YouTube)', 'Link (e.g. YouTube)')}
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </label>
      <label>
        {pick('Megjegyzés', 'Note')}
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={pick('pl. 80 BPM-ről indulj, a fillre figyelj', 'e.g. start at 80 BPM, watch the fill')} />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? pick('Mentés…', 'Saving…') : pick('Kiadás a diáknak', 'Assign to student')}
      </button>
    </form>
  );
}
