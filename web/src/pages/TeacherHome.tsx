import { Link } from 'react-router-dom';
import { Brand, TopBar } from '../components/TopBar';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

/** Tanári kezdőlap: két nagy választás, a diákok és a tananyag. */
export function TeacherHome() {
  const { signOut } = useAuth();
  const { pick } = useI18n();
  return (
    <>
      <TopBar title={<Brand />} hideName />
      <main className="page">
        <nav className="home-tiles">
          <Link className="home-tile tone-0" to="/diakok">
            {pick('Diákjaim', 'My students')}
          </Link>
          <Link className="home-tile tone-1" to="/tananyag">
            {pick('Tananyag', 'Library')}
          </Link>
        </nav>
        <button className="btn ghost signout" onClick={() => void signOut()}>
          {pick('Kilépés', 'Sign out')}
        </button>
      </main>
    </>
  );
}
