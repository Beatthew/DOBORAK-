import { useState } from 'react';
import { grooveBars } from '../audio/engine';
import { usePlayback } from '../audio/playback';
import { useI18n } from '../i18n';
import { spotifyHref } from '../lib/spotify';
import type { Groove, Lesson } from '../types';
import { GrooveGrid } from './GrooveGrid';
import { ArrowOutIcon, ChevronIcon, PlayIcon, StopIcon } from './Icons';

interface Props {
  groove: Groove;
  lesson: Lesson;
  index: number;
}

export function GrooveBlock({ groove, lesson, index }: Props) {
  const { t, pick } = useI18n();
  const { playingId, toggle } = usePlayback();
  const id = `groove:${groove.id}`;
  const playing = playingId === id;
  const songs = lesson.songs.filter((s) => s.grooveId === groove.id);
  const [open, setOpen] = useState(true);
  const listId = `songs-${groove.id}`;

  return (
    <section id={`groove-${groove.id}`} className={`groove-block tone-${index % 4}`}>
      <div className="groove-head">
        <div>
          <h2>{groove.name}</h2>
          {(groove.noteHu || groove.noteEn) && (
            <div className="fill-sub">{pick(groove.noteHu ?? '', groove.noteEn ?? '')}</div>
          )}
        </div>
        <button
          type="button"
          className="play"
          aria-label={`${playing ? t.stop : t.play}: ${groove.name}`}
          onClick={() => toggle(id, grooveBars(groove), { bpm: lesson.bpm, loop: true })}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>
      </div>
      <GrooveGrid groove={groove} />
      {songs.length > 0 && (
        <div className="songs">
          <button
            type="button"
            className="songs-toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            {t.playAlong}
            <ChevronIcon up={open} />
          </button>
          {open && (
            <ul id={listId}>
              {songs.map((song) => {
                const href = spotifyHref(song.spotifyUrl);
                return (
                  <li key={song.id}>
                    <div className="song-text">
                      <div className="song-title">{song.title}</div>
                      <div className="song-artist">{song.artist}</div>
                    </div>
                    {href && (
                      <a
                        className="spotify"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t.openOnSpotify}: ${song.title}`}
                      >
                        Spotify
                        <ArrowOutIcon />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
