import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { findExercise, findSong, songPath } from '../data/catalog';
import { toBeats } from '../data/library';
import { KIND_LABEL, openFile, type Material } from '../lib/supabase';
import { ScorePlayer } from './Score';

const KIND_TONE: Record<Material['kind'], number> = { song: 0, exercise: 3, material: 1, library: 3 };

interface Props {
  m: Material;
  /** Tanári nézetben: törlés gomb. */
  onDelete?: () => void;
}

/** Egy kiadott anyag: dal → a dal gyakorló oldala, gyakorlat → kész óra, fájl → letöltés, link → megnyitás. */
export function MaterialCard({ m, onDelete }: Props) {
  const song = m.kind === 'song' ? findSong(m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  const title = m.title || song?.title || ex?.title || KIND_LABEL[m.kind];
  const beats = useMemo(() => (m.bars ?? []).map(toBeats), [m.bars]);
  const [bpm, setBpm] = useState(m.bpm ?? 90);
  return (
    <article className={`mat tone-${KIND_TONE[m.kind]}`}>
      <div className="mat-head">
        <span className="mat-kind">{KIND_LABEL[m.kind]}</span>
        <span className="mat-date">{new Date(m.created_at).toLocaleDateString('hu-HU')}</span>
      </div>
      <h3>{title}</h3>
      {song && song.artist && <p className="mat-sub">{song.artist}</p>}
      {m.note && <p className="mat-note">{m.note}</p>}
      {beats.length > 0 && (
        <div className="mat-score">
          <ScorePlayer id={m.id} bars={beats} bpm={bpm} onBpm={setBpm} />
        </div>
      )}
      <div className="mat-actions">
        {song && <Link className="btn primary" to={songPath(song.id)}>Gyakorlás</Link>}
        {ex && <Link className="btn primary" to={`/lesson/${ex.ref}`}>Megnyitás</Link>}
        {m.file_path && (
          <button className="btn" onClick={() => openFile(m.file_path!)}>
            {m.file_name || 'Fájl'}
          </button>
        )}
        {m.link_url && (
          <a className="btn" href={m.link_url} target="_blank" rel="noreferrer">
            Link
          </a>
        )}
        {onDelete && (
          <button className="btn" onClick={onDelete}>
            Törlés
          </button>
        )}
      </div>
    </article>
  );
}
