import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { preloadSamples } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { ExerciseCard } from '../components/ExerciseCard';
import { PracticeMixer } from '../components/Score';
import { PRACTICE_MIX0, setPracticeMix } from '../audio/engine';
import { FillBlock } from '../components/FillBlock';
import { GrooveBlock } from '../components/GrooveBlock';
import { StaffKey } from '../components/StaffNotation';
import { TopBar } from '../components/TopBar';
import { findFill, findGroove, grooveTone, lessons } from '../data/lessons';
import { useI18n } from '../i18n';
import type { Fill, Groove } from '../types';

export function LessonPage() {
  const { number } = useParams();
  const { t } = useI18n();
  const { stop } = usePlayback();
  const { state } = useLocation() as { state: { back?: string } | null };
  const back = state?.back ?? '/';
  // a kész óra gyakorlatainak saját keverése (az oldalra érvényes, a többi gyakorlatra nem hat)
  const [mix, setMix] = useState(PRACTICE_MIX0);
  useEffect(() => setPracticeMix(PRACTICE_MIX0), []);
  const lesson = lessons.find((l) => String(l.number) === number);

  useEffect(() => stop, [stop]);
  // Decode the drum samples while the page is read, so the first play starts straight away.
  useEffect(() => {
    void preloadSamples();
  }, []);

  if (!lesson) {
    return (
      <>
        <TopBar title={t.lessons} backTo={back} backLabel={t.back} />
        <main className="page">
          <p className="muted">{t.lessonMissing}</p>
        </main>
      </>
    );
  }

  const shownGrooves = lesson.grooveIds.map(findGroove).filter((g): g is Groove => !!g);
  const shownFills = lesson.fillIds.map(findFill).filter((f): f is Fill => !!f);

  return (
    <>
      <TopBar title={t.lessonN(lesson.number)} backTo={back} backLabel={t.back}>
        <nav className="chips" aria-label={t.lessonN(lesson.number)}>
          {shownGrooves.map((g) => (
            <a
              key={g.id}
              className={`chip tone-${grooveTone(g.id)}`}
              href={`#groove-${g.id}`}
              onClick={scrollTo(`groove-${g.id}`)}
            >
              {g.name}
            </a>
          ))}
          {shownFills.length > 0 && (
            <a className="chip tone-2" href="#fills" onClick={scrollTo('fills')}>
              {t.fills}
            </a>
          )}
          {lesson.exercises.length > 0 && (
            <a className="chip" href="#exercises" onClick={scrollTo('exercises')}>
              {t.exercises}
            </a>
          )}
        </nav>
      </TopBar>
      <main style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <PracticeMixer className="lesson-mix" mix={mix} onChange={(m) => { setMix(m); setPracticeMix(m); }} />
        {shownGrooves.map((g) => (
          <GrooveBlock key={g.id} groove={g} lesson={lesson} index={grooveTone(g.id)} />
        ))}
        {shownFills.length > 0 && (
          <>
            <section id="fills" className="fills-intro">
              <StaffKey />
              <p>
                <b>{t.stickingKey}</b>
                <br />
                {t.landingKey}
              </p>
            </section>
            {shownFills.map((f) => (
              <FillBlock key={f.id} fill={f} bpm={lesson.bpm} />
            ))}
          </>
        )}
        {lesson.exercises.length > 0 && (
          <section id="exercises" className="exercises">
            <h2>{t.exercises}</h2>
            <div className="exercise-list">
              {lesson.exercises.map((e, i) => (
                <ExerciseCard key={e.id} exercise={e} bpm={lesson.bpm} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

// The app uses hash routing, so in-page anchors scroll by hand instead of changing the URL.
function scrollTo(elementId: string) {
  return (event: React.MouseEvent) => {
    event.preventDefault();
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}
