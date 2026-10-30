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

  useEffect(() => {
    if (!supabase || !profile) return;
    void Promise.all([
      supabase.from('lessons').select('*').eq('student_id', profile.id).order('date', { ascending: false }),
      supabase.from('materials').select('*').eq('lesson_id', lessonId).order('created_at', { ascending: false }),
    ]).then(([l, m]) => {
      setLessons((l.data as LessonRow[]) ?? []);
      setMaterials((m.data as Material[]) ?? []);
    });
  }, [profile, lessonId]);

  const backLabel = pick('Óráim', 'My lessons');
  const lesson = lessons?.find((l) => l.id === lessonId);
  if (!lesson) {
    return (
      <>
        <TopBar title={pick('Óra', 'Lesson')} backTo="/" backLabel={backLabel} />
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
      <TopBar title={text(lesson.title) || t.lessonN(number)} backTo="/" backLabel={backLabel}>
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
