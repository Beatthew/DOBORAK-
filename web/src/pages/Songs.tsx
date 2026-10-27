import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { songPath } from '../data/catalog';
import { SONGS } from '../songs';

/** A Diákjaimba behúzott dalok (a tanárnak: átnézni, mielőtt kiadja valakinek). */
export function Songs() {
  return (
    <>
      <TopBar title="Dalok" backTo="/" backLabel="Diákjaim" />
      <main className="page">
        <div className="grid">
          {SONGS.map((s, i) => (
            <Link key={s.id} to={songPath(s.id)} className={`lesson-card tone-${i % 2}`}>
              <div className="lesson-card-text">
                <div className="lesson-card-title">{s.title}</div>
                <div className="lesson-card-sub">
                  {[s.artist, `${s.bpm} BPM`, `${s.elements.filter((e) => e.type === 'groove').length} groove`, `${s.elements.filter((e) => e.type === 'fill').length} fill`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
