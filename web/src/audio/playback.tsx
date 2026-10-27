import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Player, type Bar } from './engine';

interface Playback {
  /** Id of whatever is sounding right now, or null. */
  playingId: string | null;
  /** Eighth notes played so far in the current run (0 before the first one). */
  step: number;
  toggle: (id: string, bars: Bar[], opts: { bpm: number; loop: boolean }) => void;
  stop: () => void;
}

const PlaybackContext = createContext<Playback | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const player = useRef<Player>();
  if (!player.current) player.current = new Player();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const stop = useCallback(() => {
    player.current?.stop();
    setPlayingId(null);
    setStep(0);
  }, []);

  useEffect(() => () => player.current?.stop(), []);

  const value = useMemo<Playback>(
    () => ({
      playingId,
      step,
      stop,
      toggle: (id, bars, opts) => {
        if (playingId === id) {
          stop();
          return;
        }
        setStep(0);
        setPlayingId(id);
        void player.current
          ?.start(bars, {
            ...opts,
            onStep: opts.loop ? undefined : (s) => setStep(s),
            onEnd: stop,
          })
          .then((started) => {
            if (!started) setPlayingId((current) => (current === id ? null : current));
          });
      },
    }),
    [playingId, step, stop],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): Playback {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used inside PlaybackProvider');
  return ctx;
}
