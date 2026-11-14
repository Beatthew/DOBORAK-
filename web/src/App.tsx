import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PlaybackProvider } from './audio/playback';
import { AuthProvider, useAuth } from './auth';
import { I18nProvider } from './i18n';
import { LessonComposer } from './pages/LessonComposer';
import { LessonPage } from './pages/LessonPage';
import { Lessons } from './pages/Lessons';
import { Library } from './pages/Library';
import { LibraryCategory } from './pages/LibraryCategory';
import { LibraryEdit } from './pages/LibraryEdit';
import { LibraryItem } from './pages/LibraryItem';
import { Login } from './pages/Login';
import { SongEditor } from './pages/SongEditor';
import { SongPage } from './pages/SongPage';
import { StudentHome } from './pages/StudentHome';
import { StrokesPage } from './pages/StrokesPage';
import { StudentLesson } from './pages/StudentLesson';
import { GearQuizPage } from './pages/GearQuizPage';
import { GEAR_PATH } from './data/gear';
import { STROKES_PATH } from './data/strokes';
import { KICK_PERMS_PATH } from './data/kickPermutations';
import { KickPermutationsPage } from './pages/KickPermutationsPage';
import { VOICE_SPLIT_PATH } from './data/voiceSplit';
import { VoiceSplitPage } from './pages/VoiceSplitPage';
import { Students } from './pages/Students';
import { TeacherHome } from './pages/TeacherHome';
import { TeacherStudent } from './pages/TeacherStudent';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Az oldal szélessége: az órák (telefonra rajzolt, színes sávos) oldalai keskeny oszlopban,
 *  a többi oldal tableten és gépen kihasználja a szélességet. */
function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const narrow = pathname.startsWith('/lesson/');
  return <div className={`app${narrow ? '' : ' wide'}`}>{children}</div>;
}

/** Csak helyi fejlesztéshez (npm run dev): sessionStorage 'dev-teacher' = a tanári oldalak belépés nélkül; az éles buildben nincs. */
const devTeacher = () => import.meta.env.DEV && !!sessionStorage.getItem('dev-teacher');

/** Csak belépve látható; a tanári oldalak csak a tanárnak. */
function Gate({ teacher, children }: { teacher?: boolean; children: ReactNode }) {
  const { ready, session, profile } = useAuth();
  if (devTeacher()) return <>{children}</>;
  if (!ready) return <p className="muted page">Betöltés…</p>;
  if (!session) return <Login />;
  if (!profile) return <p className="muted page">Betöltés…</p>;
  if (teacher && profile.role !== 'teacher') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** A kezdőlap a szereptől függ: a tanár a diákok / tananyag választót, a diák a saját anyagait látja. */
function Home() {
  const { profile } = useAuth();
  return profile?.role === 'teacher' || devTeacher() ? <TeacherHome /> : <StudentHome />;
}

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <PlaybackProvider>
          <HashRouter>
            <ScrollToTop />
            <Shell>
              <Routes>
                <Route path="/" element={<Gate><Home /></Gate>} />
                <Route path="/ora/:lessonId" element={<Gate><StudentLesson /></Gate>} />
                <Route path={STROKES_PATH} element={<Gate><StrokesPage /></Gate>} />
                <Route path={GEAR_PATH} element={<Gate><GearQuizPage /></Gate>} />
                <Route path={KICK_PERMS_PATH} element={<Gate><KickPermutationsPage /></Gate>} />
                <Route path={VOICE_SPLIT_PATH} element={<Gate><VoiceSplitPage /></Gate>} />
                <Route path="/diak/:id" element={<Gate teacher><TeacherStudent /></Gate>} />
                <Route path="/diak/:id/uj-ora" element={<Gate teacher><LessonComposer /></Gate>} />
                <Route path="/diak/:id/ora/:lessonId" element={<Gate teacher><LessonComposer /></Gate>} />
                <Route path="/diakok" element={<Gate teacher><Students /></Gate>} />
                <Route path="/tananyag" element={<Gate teacher><Library /></Gate>} />
                <Route path="/tananyag/:cat" element={<Gate teacher><LibraryCategory /></Gate>} />
                <Route path="/tananyag/dalok/:id/szerkesztes" element={<Gate teacher><SongEditor /></Gate>} />
                <Route path="/tananyag/:cat/uj" element={<Gate teacher><LibraryEdit /></Gate>} />
                <Route path="/tananyag/:cat/:item" element={<Gate teacher><LibraryItem /></Gate>} />
                <Route path="/tananyag/:cat/:item/szerkesztes" element={<Gate teacher><LibraryEdit /></Gate>} />
                <Route path="/dal/:id/:sel?" element={<Gate><SongPage /></Gate>} />
                {/* csak helyi fejlesztéshez (npm run dev): a dal-oldal belépés nélkül; az éles buildben nincs benne */}
                {import.meta.env.DEV && <Route path="/dev/dal/:id/:sel?" element={<SongPage />} />}
                <Route path="/gyakorlatok" element={<Gate teacher><Lessons /></Gate>} />
                <Route path="/lesson/:number" element={<Gate><LessonPage /></Gate>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </HashRouter>
        </PlaybackProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
