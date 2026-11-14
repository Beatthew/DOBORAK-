import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { findExercise, songPath } from '../data/catalog';
import { findSong, useSongs } from '../songs/store';
import { toBeats } from '../data/library';
import { GEAR_PATH, GEAR_REF } from '../data/gear';
import { KICK_PERMS_PATH, KICK_PERMS_REF } from '../data/kickPermutations';
import { STROKES_PATH, STROKES_REF } from '../data/strokes';
import { VOICE_SPLIT_PATH, VOICE_SPLIT_REF } from '../data/voiceSplit';
import { useI18n } from '../i18n';
import { KIND_LABEL, openFile, type Material } from '../lib/supabase';
import { findClip } from '../songs/clips';
import { ClipPlayer, StoredClipPlayer } from './ClipPlayer';
import { ScorePlayer } from './Score';

const KIND_TONE: Record<Material['kind'], number> = { song: 0, exercise: 3, material: 1, library: 3 };

interface Props {
  m: Material;
  /** Tanári nézetben: törlés gomb. */
  onDelete?: () => void;
}

/** Egy kiadott anyag: dal → a dal gyakorló oldala, gyakorlat → kész óra, fájl → letöltés, link → megnyitás. */
export function MaterialCard({ m, onDelete }: Props) {
  const { pick, text, locale } = useI18n();
  const strokes = m.ref === STROKES_REF || m.ref === KICK_PERMS_REF || m.ref === VOICE_SPLIT_REF;
  const clip = m.kind === 'library' ? findClip(m.ref) : undefined;
  const songs = useSongs();
  const song = m.kind === 'song' ? findSong(songs, m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  const title = text(m.title || song?.title || ex?.title || KIND_LABEL[m.kind]);
  const beats = useMemo(() => (m.bars ?? []).map(toBeats), [m.bars]);
  const [bpm, setBpm] = useState(m.bpm ?? 90);
  return (
    <article className={`mat tone-${KIND_TONE[m.kind]}`}>
      <div className="mat-head">
        <span className="mat-kind">{text(KIND_LABEL[m.kind])}</span>
        <span className="mat-date">{new Date(m.created_at).toLocaleDateString(locale)}</span>
      </div>
      <h3>{title}</h3>
      {song && song.artist && <p className="mat-sub">{song.artist}</p>}
      {m.note && <p className="mat-note">{text(m.note)}</p>}
      {!strokes && beats.length > 0 && (
        <div className="mat-score">
          {m.clip ? <StoredClipPlayer clip={m.clip} title={title} bpm={m.bpm ?? 90} main={beats} /> : clip ? <ClipPlayer clip={clip} /> : <ScorePlayer id={m.id} bars={beats} bpm={bpm} onBpm={setBpm} min={m.bpm_min} max={m.bpm_max} />}
        </div>
      )}
      <div className="mat-actions">
        {m.ref === VOICE_SPLIT_REF && <Link className="btn primary" to={VOICE_SPLIT_PATH}>{pick('Megnyitás', 'Open')}</Link>}
        {m.ref === KICK_PERMS_REF && <Link className="btn primary" to={KICK_PERMS_PATH}>{pick('Megnyitás', 'Open')}</Link>}
        {m.ref === STROKES_REF && <Link className="btn primary" to={STROKES_PATH}>{pick('Megnyitás', 'Open')}</Link>}
        {m.ref === GEAR_REF && <Link className="btn primary" to={GEAR_PATH}>{pick('Megnyitás', 'Open')}</Link>}
        {song && <Link className="btn primary" to={songPath(song.id)}>{pick('Gyakorlás', 'Practice')}</Link>}
        {ex && <Link className="btn primary" to={`/lesson/${ex.ref}`}>{pick('Megnyitás', 'Open')}</Link>}
        {m.file_path && (
          <button className="btn" onClick={() => openFile(m.file_path!)}>
            {m.file_name || pick('Fájl', 'File')}
          </button>
        )}
        {m.link_url && (
          <a className="btn" href={m.link_url} target="_blank" rel="noreferrer">
            Link
          </a>
        )}
        {onDelete && (
          <button className="btn" onClick={onDelete}>
            {pick('Törlés', 'Delete')}
          </button>
        )}
      </div>
    </article>
  );
}
