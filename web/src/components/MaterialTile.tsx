import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { findExercise, findSong, songPath } from '../data/catalog';
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
  const song = m.kind === 'song' ? findSong(m.ref) : undefined;
  const ex = m.kind === 'exercise' ? findExercise(m.ref) : undefined;
  const targets = [song || ex, m.file_path, m.link_url].filter(Boolean).length;
  if (targets !== 1 || m.bars?.length) return <MaterialCard m={m} />;

  const cls = `lesson-card tone-${tone}`;
  const kind = text(KIND_LABEL[m.kind]);
  const sub = song ? [song.artist, `${song.bpm} BPM`] : [kind, m.file_name];
  const body: ReactNode = (
    <div className="lesson-card-text">
      <div className="lesson-card-title">{text(m.title || song?.title || ex?.title || KIND_LABEL[m.kind])}</div>
      <div className="lesson-card-sub">{sub.filter(Boolean).join(' · ')}</div>
      {m.note && <p className="lesson-notes">{text(m.note)}</p>}
    </div>
  );

  if (song) return <Link className={cls} to={songPath(song.id)} state={{ back }}>{body}</Link>;
  if (ex) return <Link className={cls} to={`/lesson/${ex.ref}`} state={{ back }}>{body}</Link>;
  if (m.file_path) return <button className={cls} aria-label={`${pick('Megnyitás', 'Open')}: ${m.file_name || kind}`} onClick={() => openFile(m.file_path!)}>{body}</button>;
  return <a className={cls} href={m.link_url!} target="_blank" rel="noreferrer">{body}</a>;
}
