import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ScorePlayer } from '../components/Score';
import { TopBar } from '../components/TopBar';
import { toBeats, useLibrary } from '../data/library';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';

/** Egy tétel: visszahallgatható kotta, és ha képről készült, az eredeti kép. */
export function LibraryItem() {
  const { pick, text } = useI18n();
  const { cat = '', item: itemId = '' } = useParams();
  const nav = useNavigate();
  const { categories, items, ready } = useLibrary();
  const item = items.find((i) => i.id === itemId && i.category === cat);
  const backLabel = text(categories.find((c) => c.id === cat)?.name ?? 'Tananyag');
  const bars = useMemo(() => (item?.bars ?? []).map(toBeats), [item]);
  const [bpm, setBpm] = useState(90);
  const [image, setImage] = useState('');

  useEffect(() => {
    if (item) setBpm(item.bpm);
    if (!item?.image_path || !supabase) return;
    void supabase.storage
      .from('materials')
      .createSignedUrl(item.image_path, 60 * 10)
      .then(({ data }) => setImage(data?.signedUrl ?? ''));
  }, [item]);

  if (!item) {
    return (
      <>
        <TopBar title={backLabel} backTo={`/tananyag/${cat}`} backLabel={backLabel} />
        <main className="page">
          <p className="muted">{ready ? pick('Ez a tétel nem található.', 'This item does not exist.') : pick('Betöltés…', 'Loading…')}</p>
        </main>
      </>
    );
  }

  const remove = async () => {
    if (!supabase || !confirm(`${pick('Törlöd', 'Delete')}: ${text(item.title)}?`)) return;
    if (item.image_path) await supabase.storage.from('materials').remove([item.image_path]);
    const { error } = await supabase.from('library_items').delete().eq('id', item.id);
    if (error) return alert(error.message);
    nav(`/tananyag/${cat}`, { replace: true });
  };

  return (
    <>
      <TopBar title={text(item.title)} backTo={`/tananyag/${cat}`} backLabel={backLabel}>
        {item.subtitle && <p className="top-sub">{text(item.subtitle)}</p>}
      </TopBar>
      <main className="page">
        {bars.length > 0 ? (
          <ScorePlayer id={item.id} bars={bars} bpm={bpm} onBpm={setBpm} />
        ) : (
          <p className="note-box">{pick('Ez a tétel még nincs átírva kottára.', 'This item has not been transcribed yet.')}</p>
        )}
        {item.note && <p className="muted">{text(item.note)}</p>}
        {image &&
          (/\.pdf$/i.test(item.file_name ?? '') ? (
            <a className="btn ghost big" href={image} target="_blank" rel="noreferrer">
              {pick('Eredeti kotta', 'Original score')}: {item.file_name}
            </a>
          ) : (
            <img className="source-image" src={image} alt={`${pick('Eredeti kotta', 'Original score')}: ${text(item.title)}`} />
          ))}
        <div className="action-row">
          {item.builtin ? (
            <Link className="btn ghost big" to={`/tananyag/${cat}/uj`} state={{ copyOf: item }}>
              {pick('Másolat készítése', 'Make a copy')}
            </Link>
          ) : (
            <>
              <Link className="btn primary big" to={`/tananyag/${cat}/${item.id}/szerkesztes`}>
                {pick('Szerkesztés', 'Edit')}
              </Link>
              <Link className="btn ghost big" to={`/tananyag/${cat}/uj`} state={{ copyOf: item }}>
                {pick('Másolat', 'Copy')}
              </Link>
              <button className="btn ghost big" onClick={() => void remove()}>
                {pick('Törlés', 'Delete')}
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
