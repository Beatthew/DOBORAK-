import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilIcon } from '../components/Icons';
import { MaterialCard } from '../components/MaterialCard';
import { MaterialTile } from '../components/MaterialTile';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../auth';
import { lessons as readyLessons } from '../data/lessons';
import { useI18n } from '../i18n';
import { supabase, type LessonRow, type Material } from '../lib/supabase';

/** Az óra száma: a kész óráé, vagy a helye a (legújabb elöl rendezett) listában. */
export const lessonNumber = (lessons: LessonRow[], l: LessonRow) =>
  readyLessons.find((x) => String(x.number) === l.doborak)?.number ?? lessons.length - lessons.indexOf(l);

type Tab = 'lessons' | 'songs' | 'exercises';
const TABS: [Tab, string, string][] = [['lessons', 'Óráim', 'My lessons'], ['songs', 'Dalok', 'Songs'], ['exercises', 'Gyakorlatok', 'Exercises']];

/** A diák kezdőlapja: a neki kiadott órák, dalok és gyakorlatok, fülekre szűrve. */
export function StudentHome() {
  const { profile, signOut } = useAuth();
  const { pick } = useI18n();
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

  const chooseTab = (t: Tab) => {
    setTab(t);
    sessionStorage.setItem('tab', t);
  };
  // ami egy órához van csatolva, az az óra alatt látszik; a Gyakorlatok fülön csak a külön kiadott gyakorlatok
  const of = (kind: Material['kind']) => materials.filter((m) => m.kind === kind && (kind !== 'exercise' || !m.lesson_id));

  return (
    <>
      <TopBar title={profile?.full_name || pick('Szia!', 'Hi!')}>
        <nav className="tabs">
          {TABS.map(([t, huLabel, enLabel]) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => chooseTab(t)}>
              {pick(huLabel, enLabel)}
            </button>
          ))}
        </nav>
      </TopBar>
      <main className="page">
        {lessons === null ? (
          <p className="muted">{pick('Betöltés…', 'Loading…')}</p>
        ) : tab === 'lessons' ? (
          <MyLessons lessons={lessons} materials={materials} />
        ) : (
          <List items={of(tab === 'songs' ? 'song' : 'exercise')} empty={tab === 'songs' ? pick('Még nincs kiadott dalod.', 'No songs assigned yet.') : pick('Még nincs kiadott gyakorlatod.', 'No exercises assigned yet.')} />
        )}
        <button className="btn ghost signout full" onClick={() => void signOut()}>
          {pick('Kilépés', 'Sign out')}
        </button>
      </main>
    </>
  );
}

function List({ items, empty }: { items: Material[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <div className="grid">
      {items.map((m, i) => (
        <MaterialTile key={m.id} m={m} tone={i % 2} />
      ))}
    </div>
  );
}

/** A diák órái: az egész kártya az órába visz (StudentLesson); az órához nem kötött anyagok külön. */
function MyLessons({ lessons, materials }: { lessons: LessonRow[]; materials: Material[] }) {
  const { t, pick, text, locale } = useI18n();
  const loose = materials.filter((m) => m.kind === 'material' && !m.lesson_id);
  if (!lessons.length && !loose.length) return <p className="muted">{pick('Még nincs rögzített óra.', 'No lessons yet.')}</p>;
  return (
    <>
      <div className="grid">
        {[...lessons].reverse().map((l) => {
          const number = lessonNumber(lessons, l);
          return (
            <Link key={l.id} className={`lesson-card tone-${(number + 1) % 2}`} to={`/ora/${l.id}`}>
              <div className="lesson-card-num">{number}</div>
              <div className="lesson-card-text">
                <div className="lesson-card-title">{text(l.title) || t.lessonN(number)}</div>
                <div className="lesson-card-sub">{new Date(l.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            </Link>
          );
        })}
      </div>
      {loose.length > 0 && (
        <section className="lesson-group">
          <h2 className="group-title">{pick('Egyéb órai anyagok', 'Other lesson materials')}</h2>
          {loose.map((m, i) => (
            <MaterialTile key={m.id} m={m} tone={i % 2} />
          ))}
        </section>
      )}
    </>
  );
}

/** Az órák nagy kártyákon (mint a kész órák listája); az órához csatolt anyagok a kártya mögött, az óra oldalán;
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
  const { t, pick, text, locale } = useI18n();
  const loose = materials.filter((m) => m.kind === 'material' && !m.lesson_id);
  if (!lessons.length && !loose.length) return <p className="muted">{pick('Még nincs rögzített óra.', 'No lessons yet.')}</p>;
  return (
    <div className="grid">
      {(ascending ? [...lessons].reverse() : lessons).map((l) => {
        const att = materials.filter((m) => m.lesson_id === l.id);
        const content = readyLessons.find((x) => String(x.number) === l.doborak);
        const number = lessonNumber(lessons, l);
        const date = new Date(l.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
        const title = text(l.title) || t.lessonN(number);
        const summary = content
          ? t.summary({ grooves: content.grooveIds.length, fills: content.fillIds.length, exercises: content.exercises.length, songs: content.songs.length })
          : att.length ? pick(`${att.length} anyag`, `${att.length} ${att.length === 1 ? 'item' : 'items'}`) : '';
        const body = (
          <>
            <div className="lesson-card-num">{number}</div>
            <div className="lesson-card-text">
              <div className="lesson-card-title">{title}</div>
              <div className="lesson-card-sub">{[date, summary].filter(Boolean).join(' · ')}</div>
              {l.notes && <p className="lesson-notes">{l.notes}</p>}
            </div>
          </>
        );
        const tone = `lesson-card tone-${(number + 1) % 2}`;
        return (
          <section key={l.id} className="lesson-group">
            <div className="lesson-row">
              {content && !att.length ? (
                <Link className={tone} to={`/lesson/${content.number}`} state={{ back }}>
                  {body}
                </Link>
              ) : att.length ? (
                <Link className={tone} to={`/ora/${l.id}`}>
                  {body}
                </Link>
              ) : (
                <div className={tone}>{body}</div>
              )}
              {onEdit && (
                <button className="edit-tile" aria-label={`${pick('Szerkesztés', 'Edit')}: ${title}`} onClick={() => onEdit(l)}>
                  <PencilIcon />
                </button>
              )}
            </div>
          </section>
        );
      })}
      {loose.length > 0 && (
        <section className="lesson-group">
          <h2 className="group-title">{pick('Egyéb órai anyagok', 'Other lesson materials')}</h2>
          {loose.map((m) => (
            <MaterialCard key={m.id} m={m} onDelete={onDelete && (() => onDelete(m))} />
          ))}
        </section>
      )}
    </div>
  );
}
