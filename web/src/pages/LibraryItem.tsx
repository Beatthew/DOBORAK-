import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ScorePlayer } from '../components/Score';
import { TopBar } from '../components/TopBar';
import { toBeats, useLibrary } from '../data/library';
import { supabase } from '../lib/supabase';

/** Egy tétel: visszahallgatható kotta, és ha képről készült, az eredeti kép. */
export function LibraryItem() {
  const { cat = '', item: itemId = '' } = useParams();
  const nav = useNavigate();
  const { categories, items, ready } = useLibrary();
  const item = items.find((i) => i.id === itemId && i.category === cat);
  const backLabel = categories.find((c) => c.id === cat)?.name ?? 'Tananyag';
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
          <p className="muted">{ready ? 'Ez a tétel nem található.' : 'Betöltés…'}</p>
        </main>
      </>
    );
  }

  const remove = async () => {
    if (!supabase || !confirm(`Törlöd: ${item.title}?`)) return;
    if (item.image_path) await supabase.storage.from('materials').remove([item.image_path]);
    const { error } = await supabase.from('library_items').delete().eq('id', item.id);
    if (error) return alert(error.message);
    nav(`/tananyag/${cat}`, { replace: true });
  };

  return (
    <>
      <TopBar title={item.title} backTo={`/tananyag/${cat}`} backLabel={backLabel}>
        {item.subtitle && <p className="top-sub">{item.subtitle}</p>}
      </TopBar>
      <main className="page">
        {bars.length > 0 ? (
          <ScorePlayer id={item.id} bars={bars} bpm={bpm} onBpm={setBpm} />
        ) : (
          <p className="note-box">Ez a tétel még nincs átírva kottára.</p>
        )}
        {item.note && <p className="muted">{item.note}</p>}
        {image &&
          (/\.pdf$/i.test(item.file_name ?? '') ? (
            <a className="btn ghost big" href={image} target="_blank" rel="noreferrer">
              Eredeti kotta: {item.file_name}
            </a>
          ) : (
            <img className="source-image" src={image} alt={`Eredeti kotta: ${item.title}`} />
          ))}
        <div className="action-row">
          {item.builtin ? (
            <Link className="btn ghost big" to={`/tananyag/${cat}/uj`} state={{ copyOf: item }}>
              Másolat készítése
            </Link>
          ) : (
            <>
              <Link className="btn primary big" to={`/tananyag/${cat}/${item.id}/szerkesztes`}>
                Szerkesztés
              </Link>
              <Link className="btn ghost big" to={`/tananyag/${cat}/uj`} state={{ copyOf: item }}>
                Másolat
              </Link>
              <button className="btn ghost big" onClick={() => void remove()}>
                Törlés
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
