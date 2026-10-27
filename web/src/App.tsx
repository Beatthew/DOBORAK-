import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PlaybackProvider } from './audio/playback';
import { AuthProvider, useAuth } from './auth';
import { I18nProvider } from './i18n';
import { LessonPage } from './pages/LessonPage';
import { Lessons } from './pages/Lessons';
import { Login } from './pages/Login';
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
            <div className="app">
              <Routes>
                <Route path="/" element={<Gate><Home /></Gate>} />
                <Route path="/diak/:id" element={<Gate teacher><TeacherStudent /></Gate>} />
                <Route path="/gyakorlatok" element={<Gate><Lessons /></Gate>} />
                <Route path="/lesson/:number" element={<Gate><LessonPage /></Gate>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </HashRouter>
        </PlaybackProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
