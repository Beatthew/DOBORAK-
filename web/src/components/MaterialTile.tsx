import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { findExercise, songPath } from '../data/catalog';
import { findSong, useSongs } from '../songs/store';
import { GEAR_PATH, GEAR_REF } from '../data/gear';
import { KICK_PERMS_PATH, KICK_PERMS_REF } from '../data/kickPermutations';
import { STROKES_PATH, STROKES_REF } from '../data/strokes';
import { useI18n } from '../i18n';
import { KIND_LABEL, openFile, type Material } from '../lib/supabase';
import { MaterialCard } from './MaterialCard';

interface Props {
  m: Material;
  /** A kártya színe a listában elfoglalt hely szerint. */
  tone: number;
  /** Ide visz vissza a megnyitott dal vagy óra. */
  back?: string;
}

/** A diák kártyája: ha az anyag egy helyre visz, az egész kártya a gomb.
 *  Ami többet tud (kotta lejátszóval, fájl és link együtt), az marad MaterialCard. */
export function MaterialTile({ m, tone, back }: Props) {
  const { pick, text } = useI18n();
  const songs = useSongs();
  const song = m.kind === 'song' ? findSong(songs, m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  const strokes = m.ref === STROKES_REF;
  const targets = [song || ex, m.file_path, m.link_url].filter(Boolean).length;
  const gear = m.ref === GEAR_REF;
  const perms = m.ref === KICK_PERMS_REF;
  if (!strokes && !gear && !perms && (targets !== 1 || m.bars?.length)) return <MaterialCard m={m} />;

  const cls = `lesson-card tone-${tone}`;
  const kind = text(KIND_LABEL[m.kind]);
  const sub = song ? [song.artist, song.structure && `${song.structure.bpm} BPM`] : [kind, m.file_name];
  const body: ReactNode = (
    <div className="lesson-card-text">
      <div className="lesson-card-title">{text(m.title || song?.title || ex?.title || KIND_LABEL[m.kind])}</div>
      <div className="lesson-card-sub">{sub.filter(Boolean).join(' · ')}</div>
      {m.note && <p className="lesson-notes">{text(m.note)}</p>}
    </div>
  );

  if (strokes) return <Link className={cls} to={STROKES_PATH} state={{ back }}>{body}</Link>;
  if (gear) return <Link className={cls} to={GEAR_PATH} state={{ back }}>{body}</Link>;
  if (perms) return <Link className={cls} to={KICK_PERMS_PATH} state={{ back }}>{body}</Link>;
  if (song) return <Link className={cls} to={songPath(song.id)} state={{ back }}>{body}</Link>;
  if (ex) return <Link className={cls} to={`/lesson/${ex.ref}`} state={{ back }}>{body}</Link>;
  if (m.file_path) return <button className={cls} aria-label={`${pick('Megnyitás', 'Open')}: ${m.file_name || kind}`} onClick={() => openFile(m.file_path!)}>{body}</button>;
  return <a className={cls} href={m.link_url!} target="_blank" rel="noreferrer">{body}</a>;
}
