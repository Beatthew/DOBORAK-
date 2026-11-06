import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KitArt } from '../components/GearQuiz';
import { Score } from '../components/Score';
import { TopBar } from '../components/TopBar';
import { GEAR_REF } from '../data/gear';
import { subdivisionOf, SUBDIVISIONS, toBeats, useLibrary, type Subdivision } from '../data/library';
import { useI18n } from '../i18n';
import { SongsHub } from './SongsHub';

/** Egy kategória tételei, kottával, a legkisebb érték szerinti szűrővel. */
export function LibraryCategory() {
  const { pick, text } = useI18n();
  const library = pick('Tananyag', 'Library');
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
        <TopBar title={library} backTo="/tananyag" backLabel={library} />
        <main className="page">
          <p className="muted">{ready ? pick('Ez a kategória nem található.', 'This category does not exist.') : pick('Betöltés…', 'Loading…')}</p>
        </main>
      </>
    );
  }

  if (cat === 'dalok') return <SongsHub />;

  return (
    <>
      <TopBar title={text(category.name)} backTo="/tananyag" backLabel={library} />
      <main className="page">
        {mine.some((i) => i.bars.length > 0) && (
          <nav className="filters" aria-label={pick('Szűrők', 'Filters')}>
            <span>{pick('Szűrők:', 'Filters:')}</span>
            <button className={filter ? '' : 'on'} onClick={() => setFilter(null)}>
              {pick('Mind', 'All')}
            </button>
            {offered.map(([s, label]) => (
              <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
                {text(label)}
              </button>
            ))}
          </nav>
        )}
        <div className="item-grid">
          {shown.map((item, i) => (
            <Link key={item.id} className={`item-tile tone-${i % 2}`} to={`/tananyag/${cat}/${item.id}`}>
              <span className="item-tile-title">{text(item.title)}</span>
              {item.subtitle && <span className="item-tile-sub">{text(item.subtitle)}</span>}
              {`${item.category}/${item.id}` === GEAR_REF ? (
                <KitArt />
              ) : item.bars.length ? (
                <Score bars={[toBeats(item.bars[0])]} />
              ) : (
                <span className="item-tile-sub">{item.image_path ? pick('Átírásra vár', 'Awaiting transcription') : pick('Nincs kotta', 'No score')}</span>
              )}
            </Link>
          ))}
          <Link className="item-tile add-tile" to={`/tananyag/${cat}/uj`}>
            <span className="add-plus">+</span>
            <span className="item-tile-title">{pick('Új hozzáadása', 'Add new')}</span>
          </Link>
        </div>
      </main>
    </>
  );
}
