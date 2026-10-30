import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { lessons } from '../data/lessons';
import { useI18n } from '../i18n';

export function Lessons() {
  const { t, pick } = useI18n();
  const ordered = [...lessons].sort((a, b) => a.number - b.number);
  return (
    <>
      <TopBar title={pick('Kész órák', 'Ready-made lessons')} backTo="/tananyag" backLabel={pick('Tananyag', 'Library')} />
      <main className="page">
        {ordered.length === 0 ? (
          <p className="muted">{t.noLessons}</p>
        ) : (
          <div className="grid">
            {ordered.map((lesson, i) => (
              <Link key={lesson.id} to={`/lesson/${lesson.number}`} state={{ back: '/gyakorlatok' }} className={`lesson-card tone-${i % 2}`}>
                <div className="lesson-card-num">{lesson.number}</div>
                <div className="lesson-card-text">
                  <div className="lesson-card-title">{t.lessonN(lesson.number)}</div>
                  <div className="lesson-card-sub">
                    {t.summary({
                      grooves: lesson.grooveIds.length,
                      fills: lesson.fillIds.length,
                      exercises: lesson.exercises.length,
                      songs: lesson.songs.length,
                    })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
