import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Score } from '../components/Score';
import { TopBar } from '../components/TopBar';
import { songPath } from '../data/catalog';
import { subdivisionOf, SUBDIVISIONS, toBeats, useLibrary, type Subdivision } from '../data/library';
import { SONGS } from '../songs';

/** Egy kategória tételei, kottával, a legkisebb érték szerinti szűrővel. */
export function LibraryCategory() {
  const { cat = '' } = useParams();
  const { categories, items, ready } = useLibrary();
  const [filter, setFilter] = useState<Subdivision | null>(null);
  const category = categories.find((c) => c.id === cat);
  const mine = useMemo(() => items.filter((i) => i.category === cat), [items, cat]);
  const kinds = useMemo(() => new Set(mine.map((i) => subdivisionOf(i.bars))), [mine]);
  const shown = filter ? mine.filter((i) => subdivisionOf(i.bars) === filter) : mine;
  const offered = SUBDIVISIONS.filter(([s]) => s !== 'triolas' || kinds.has(s));

  if (!category) {
    return (
      <>
        <TopBar title="Tananyag" backTo="/tananyag" backLabel="Tananyag" />
        <main className="page">
          <p className="muted">{ready ? 'Ez a kategória nem található.' : 'Betöltés…'}</p>
        </main>
      </>
    );
  }

  if (cat === 'dalok') {
    return (
      <>
        <TopBar title={category.name} backTo="/tananyag" backLabel="Tananyag" />
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
          <p className="note-box">
            A dalok forrása a Songpractice: ott készül el a kotta, a <b>Küldés a BEATHUBba</b> gomb után pedig
            a <b>web</b> mappában: <b>npm run import-song -- &lt;dal id&gt;</b>
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={category.name} backTo="/tananyag" backLabel="Tananyag" />
      <main className="page">
        {mine.length > 0 && (
          <nav className="filters" aria-label="Szűrők">
            <span>Szűrők:</span>
            <button className={filter ? '' : 'on'} onClick={() => setFilter(null)}>
              Mind
            </button>
            {offered.map(([s, label]) => (
              <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="item-grid">
          {shown.map((item, i) => (
            <Link key={item.id} className={`item-tile tone-${i % 2}`} to={`/tananyag/${cat}/${item.id}`}>
              <span className="item-tile-title">{item.title}</span>
              {item.subtitle && <span className="item-tile-sub">{item.subtitle}</span>}
              {item.bars.length ? (
                <Score bars={[toBeats(item.bars[0])]} />
              ) : (
                <span className="item-tile-sub">{item.image_path ? 'Átírásra vár' : 'Nincs kotta'}</span>
              )}
            </Link>
          ))}
          <Link className="item-tile add-tile" to={`/tananyag/${cat}/uj`}>
            <span className="add-plus">+</span>
            <span className="item-tile-title">Új hozzáadása</span>
          </Link>
        </div>
      </main>
    </>
  );
}
