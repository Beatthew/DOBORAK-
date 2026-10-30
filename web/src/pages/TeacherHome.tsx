import { Link } from 'react-router-dom';
import { Brand, TopBar } from '../components/TopBar';
import { useAuth } from '../auth';

/** Tanári kezdőlap: két nagy választás, a diákok és a tananyag. */
export function TeacherHome() {
  const { signOut } = useAuth();
  return (
    <>
      <TopBar title={<Brand />} hideName />
      <main className="page">
        <nav className="home-tiles">
          <Link className="home-tile tone-0" to="/diakok">
            Diákjaim
          </Link>
          <Link className="home-tile tone-1" to="/tananyag">
            Tananyag
          </Link>
        </nav>
        <button className="btn ghost signout" onClick={() => void signOut()}>
          Kilépés
        </button>
      </main>
    </>
  );
}
