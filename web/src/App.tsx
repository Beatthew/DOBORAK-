import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PlaybackProvider } from './audio/playback';
import { AuthProvider, useAuth } from './auth';
import { I18nProvider } from './i18n';
import { LessonPage } from './pages/LessonPage';
import { Lessons } from './pages/Lessons';
import { Login } from './pages/Login';
import { SongPage } from './pages/SongPage';
import { Songs } from './pages/Songs';
import { StudentHome } from './pages/StudentHome';
import { TeacherHome } from './pages/TeacherHome';
import { TeacherStudent } from './pages/TeacherStudent';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Az oldal szélessége: a dobórák (telefonra rajzolt, színes sávos) oldalai keskeny oszlopban,
 *  a többi oldal tableten és gépen kihasználja a szélességet. */
function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const narrow = pathname.startsWith('/lesson/');
  return <div className={`app${narrow ? '' : ' wide'}`}>{children}</div>;
}

/** Csak belépve látható; a tanári oldalak csak a tanárnak. */
function Gate({ teacher, children }: { teacher?: boolean; children: ReactNode }) {
  const { ready, session, profile } = useAuth();
  if (!ready) return <p className="muted page">Betöltés…</p>;
  if (!session) return <Login />;
  if (!profile) return <p className="muted page">Betöltés…</p>;
  if (teacher && profile.role !== 'teacher') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** A kezdőlap a szereptől függ: a tanár a diákjait, a diák a saját anyagait látja. */
function Home() {
  const { profile } = useAuth();
  return profile?.role === 'teacher' ? <TeacherHome /> : <StudentHome />;
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
                <Route path="/diak/:id" element={<Gate teacher><TeacherStudent /></Gate>} />
                <Route path="/dalok" element={<Gate teacher><Songs /></Gate>} />
                <Route path="/dal/:id/:sel?" element={<Gate><SongPage /></Gate>} />
                {/* csak helyi fejlesztéshez (npm run dev): a dal-oldal belépés nélkül; az éles buildben nincs benne */}
                {import.meta.env.DEV && <Route path="/dev/dal/:id/:sel?" element={<SongPage />} />}
                <Route path="/gyakorlatok" element={<Gate><Lessons /></Gate>} />
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
