import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilIcon } from '../components/Icons';
import { MaterialCard } from '../components/MaterialCard';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../auth';
import { lessons as readyLessons } from '../data/lessons';
import { useI18n } from '../i18n';
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
    <div className="grid">
      {items.map((m) => (
        <MaterialCard key={m.id} m={m} />
      ))}
    </div>
  );
}

/** Az órák nagy kártyákon (mint a kész órák listája), mindegyik alatt az órához csatolt anyagok;
 *  a semmilyen órához nem kötött órai anyagok külön. */
interface LessonsListProps {
  lessons: LessonRow[];
  materials: Material[];
  /** Tanári nézetben: anyag törlése, óra szerkesztése. */
  onDelete?: (m: Material) => void;
  onEdit?: (l: LessonRow) => void;
  /** Ide visz vissza az órából a fejléc. */
  back?: string;
  /** A legrégebbi óra elöl (a tanári nézet: 1, 2, 3, +). */
  ascending?: boolean;
}

export function LessonsList({ lessons, materials, onDelete, onEdit, back, ascending }: LessonsListProps) {
  const { t } = useI18n();
  const loose = materials.filter((m) => m.kind === 'material' && !m.lesson_id);
  if (!lessons.length && !loose.length) return <p className="muted">Még nincs rögzített óra.</p>;
  return (
    <div className="grid">
      {(ascending ? [...lessons].reverse() : lessons).map((l) => {
        const i = lessons.indexOf(l);
        const att = materials.filter((m) => m.lesson_id === l.id);
        const content = readyLessons.find((x) => String(x.number) === l.doborak);
        const number = content?.number ?? lessons.length - i;
        const date = new Date(l.date).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
        const summary = content
          ? t.summary({ grooves: content.grooveIds.length, fills: content.fillIds.length, exercises: content.exercises.length, songs: content.songs.length })
          : '';
        const body = (
          <>
            <div className="lesson-card-num">{number}</div>
            <div className="lesson-card-text">
              <div className="lesson-card-title">{l.title || `${number}. óra`}</div>
              <div className="lesson-card-sub">{[date, summary].filter(Boolean).join(' · ')}</div>
              {l.notes && <p className="lesson-notes">{l.notes}</p>}
            </div>
          </>
        );
        const tone = `lesson-card tone-${(number + 1) % 2}`;
        return (
          <section key={l.id} className="lesson-group">
            <div className="lesson-row">
              {content ? (
                <Link className={tone} to={`/lesson/${content.number}`} state={{ back }}>
                  {body}
                </Link>
              ) : (
                <div className={tone}>{body}</div>
              )}
              {onEdit && (
                <button className="edit-tile" aria-label={`Szerkesztés: ${l.title || `${number}. óra`}`} onClick={() => onEdit(l)}>
                  <PencilIcon />
                </button>
              )}
            </div>
            {att.map((m) => (
              <MaterialCard key={m.id} m={m} onDelete={onDelete && (() => onDelete(m))} />
            ))}
          </section>
        );
      })}
      {loose.length > 0 && (
        <section className="lesson-group">
          <h2 className="group-title">Egyéb órai anyagok</h2>
          {loose.map((m) => (
            <MaterialCard key={m.id} m={m} onDelete={onDelete && (() => onDelete(m))} />
          ))}
        </section>
      )}
    </div>
  );
}
