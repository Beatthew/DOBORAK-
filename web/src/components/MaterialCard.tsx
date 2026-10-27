import { Link } from 'react-router-dom';
import { findExercise, findSong, songHref } from '../data/catalog';
import { KIND_LABEL, openFile, type Material } from '../lib/supabase';

interface Props {
  m: Material;
  /** Tanári nézetben: törlés gomb. */
  onDelete?: () => void;
}

/** Egy kiadott anyag: dal → Song Practice, gyakorlat → dobóra, fájl → letöltés, link → megnyitás. */
export function MaterialCard({ m, onDelete }: Props) {
  const song = m.kind === 'song' ? findSong(m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  const title = m.title || song?.title || ex?.title || KIND_LABEL[m.kind];
  return (
    <article className={`mat mat-${m.kind}`}>
      <div className="mat-head">
        <span className="mat-kind">{KIND_LABEL[m.kind]}</span>
        <span className="mat-date">{new Date(m.created_at).toLocaleDateString('hu-HU')}</span>
      </div>
      <h3>{title}</h3>
      {song && song.artist && <p className="mat-sub">{song.artist}</p>}
      {m.note && <p className="mat-note">{m.note}</p>}
      <div className="mat-actions">
        {song && <a className="btn small primary" href={songHref(song.id)}>Gyakorlás</a>}
        {ex && <Link className="btn small primary" to={`/lesson/${ex.ref}`}>Megnyitás</Link>}
        {m.file_path && (
          <button className="btn small" onClick={() => openFile(m.file_path!)}>
            {m.file_name || 'Fájl'}
          </button>
        )}
        {m.link_url && (
          <a className="btn small" href={m.link_url} target="_blank" rel="noreferrer">
            Link
          </a>
        )}
        {onDelete && (
          <button className="btn small ghost" onClick={onDelete}>
            Törlés
          </button>
        )}
      </div>
    </article>
  );
}
