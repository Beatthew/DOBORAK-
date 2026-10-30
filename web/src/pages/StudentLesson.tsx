import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MaterialTile } from '../components/MaterialTile';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../auth';
import { lessons as readyLessons } from '../data/lessons';
import { useI18n } from '../i18n';
import { supabase, type LessonRow, type Material } from '../lib/supabase';
import { lessonNumber } from './StudentHome';

/** Egy óra a diák szemével: a tanár jegyzete, a kész óra és az órához csatolt anyagok. */
export function StudentLesson() {
  const { lessonId = '' } = useParams();
  const { profile } = useAuth();
  const { t, pick, text, locale } = useI18n();
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Az óra diákja az órából derül ki: a tanár is ezt az oldalt nyitja meg (a jogosultságot az adatbázis szabja meg).
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    void (async () => {
      const { data } = await db.from('lessons').select('student_id').eq('id', lessonId).maybeSingle();
      const studentId = (data as { student_id: string } | null)?.student_id;
      if (!studentId) return setLessons([]);
      const [l, m] = await Promise.all([
        db.from('lessons').select('*').eq('student_id', studentId).order('date', { ascending: false }),
        db.from('materials').select('*').eq('lesson_id', lessonId).order('created_at', { ascending: false }),
      ]);
      setLessons((l.data as LessonRow[]) ?? []);
      setMaterials((m.data as Material[]) ?? []);
    })();
  }, [lessonId]);

  const lesson = lessons?.find((l) => l.id === lessonId);
  const teacher = profile?.role === 'teacher' || (!!lesson && lesson.student_id !== profile?.id);
  const backTo = teacher && lesson ? `/diak/${lesson.student_id}` : '/';
  const backLabel = teacher ? pick('Diák', 'Student') : pick('Óráim', 'My lessons');
  if (!lesson) {
    return (
      <>
        <TopBar title={pick('Óra', 'Lesson')} backTo={backTo} backLabel={backLabel} />
        <main className="page">
          <p className="muted">{lessons ? pick('Ez az óra nem található.', 'This lesson was not found.') : pick('Betöltés…', 'Loading…')}</p>
        </main>
      </>
    );
  }

  const number = lessonNumber(lessons!, lesson);
  const content = readyLessons.find((x) => String(x.number) === lesson.doborak);
  const back = `/ora/${lesson.id}`;
  // a kész óra az első kártya: a színek innen váltakoznak
  const first = content ? 1 : 0;
  return (
    <>
      <TopBar title={text(lesson.title) || t.lessonN(number)} backTo={backTo} backLabel={backLabel}>
        <p className="top-sub">{new Date(lesson.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </TopBar>
      <main className="page">
        {lesson.notes && <p className="note-box lesson-note">{lesson.notes}</p>}
        {content || materials.length ? (
          <div className="grid">
            {content && (
              <Link className="lesson-card tone-0" to={`/lesson/${content.number}`} state={{ back }}>
                <div className="lesson-card-text">
                  <div className="lesson-card-title">{t.lessonN(content.number)}</div>
                  <div className="lesson-card-sub">
                    {t.summary({ grooves: content.grooveIds.length, fills: content.fillIds.length, exercises: content.exercises.length, songs: content.songs.length })}
                  </div>
                </div>
              </Link>
            )}
            {materials.map((m, i) => (
              <MaterialTile key={m.id} m={m} tone={(first + i) % 2} back={back} />
            ))}
          </div>
        ) : (
          !lesson.notes && <p className="muted">{pick('Ehhez az órához még nincs anyag.', 'Nothing here for this lesson yet.')}</p>
        )}
      </main>
    </>
  );
}
