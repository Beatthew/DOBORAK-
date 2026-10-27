import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialCard } from '../components/MaterialCard';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../auth';
import { findExercise } from '../data/catalog';
import { supabase, type LessonRow, type Material } from '../lib/supabase';

type Tab = 'lessons' | 'songs' | 'exercises';
const TABS: [Tab, string][] = [['lessons', 'Óráim'], ['songs', 'Dalok'], ['exercises', 'Gyakorlatok']];

/** A diák kezdőlapja: a neki kiadott órák, dalok és gyakorlatok, fülekre szűrve. */
export function StudentHome() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('tab') as Tab) || 'lessons');
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    if (!supabase || !profile) return;
    void Promise.all([
      supabase.from('lessons').select('*').eq('student_id', profile.id).order('date', { ascending: false }),
      supabase.from('materials').select('*').eq('student_id', profile.id).order('created_at', { ascending: false }),
    ]).then(([l, m]) => {
      setLessons((l.data as LessonRow[]) ?? []);
      setMaterials((m.data as Material[]) ?? []);
    });
  }, [profile]);

  const pick = (t: Tab) => {
    setTab(t);
    sessionStorage.setItem('tab', t);
  };
  const of = (kind: Material['kind']) => materials.filter((m) => m.kind === kind);

  return (
    <>
      <TopBar title={profile?.full_name || 'Szia!'}>
        <nav className="tabs">
          {TABS.map(([t, label]) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => pick(t)}>
              {label}
            </button>
          ))}
        </nav>
      </TopBar>
      <main className="page">
        {lessons === null ? (
          <p className="muted">Betöltés…</p>
        ) : tab === 'lessons' ? (
          <LessonsList lessons={lessons} materials={materials} />
        ) : (
          <List items={of(tab === 'songs' ? 'song' : 'exercise')} empty={tab === 'songs' ? 'Még nincs kiadott dalod.' : 'Még nincs kiadott gyakorlatod.'} />
        )}
        <button className="btn ghost signout" onClick={() => void signOut()}>
          Kilépés
        </button>
      </main>
    </>
  );
}

function List({ items, empty }: { items: Material[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <div className="stack">
      {items.map((m) => (
        <MaterialCard key={m.id} m={m} />
      ))}
    </div>
  );
}

/** Az órák időrendben, mindegyik alatt az órához csatolt anyagok; a semmilyen órához nem kötött órai anyagok külön. */
interface LessonsListProps {
  lessons: LessonRow[];
  materials: Material[];
  /** Tanári nézetben: anyag törlése, óra szerkesztése. */
  onDelete?: (m: Material) => void;
  onEdit?: (l: LessonRow) => void;
}

export function LessonsList({ lessons, materials, onDelete, onEdit }: LessonsListProps) {
  const loose = materials.filter((m) => m.kind === 'material' && !m.lesson_id);
  if (!lessons.length && !loose.length) return <p className="muted">Még nincs rögzített órád.</p>;
  return (
    <div className="stack">
      {lessons.map((l) => {
        const att = materials.filter((m) => m.lesson_id === l.id);
        const dob = findExercise(l.doborak);
        return (
          <section key={l.id} className="lesson-box">
            <div className="lesson-box-head">
              <b>{l.title || 'Óra'}</b>
              <span>{new Date(l.date).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {l.notes && <p className="lesson-notes">{l.notes}</p>}
            {(dob || onEdit) && (
              <div className="mat-actions">
                {dob && (
                  <Link className="btn small primary" to={`/lesson/${dob.ref}`}>
                    {dob.title}
                  </Link>
                )}
                {onEdit && (
                  <button className="btn small ghost" onClick={() => onEdit(l)}>
                    Szerkesztés
                  </button>
                )}
              </div>
            )}
            {att.map((m) => (
              <MaterialCard key={m.id} m={m} onDelete={onDelete && (() => onDelete(m))} />
            ))}
          </section>
        );
      })}
      {loose.length > 0 && (
        <section className="lesson-box">
          <div className="lesson-box-head">
            <b>Egyéb órai anyagok</b>
          </div>
          {loose.map((m) => (
            <MaterialCard key={m.id} m={m} onDelete={onDelete && (() => onDelete(m))} />
          ))}
        </section>
      )}
    </div>
  );
}
