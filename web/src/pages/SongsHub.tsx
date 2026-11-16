import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderIcon, PencilIcon, PlayIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { songPath } from '../data/catalog';
import { useLibrary, type LibraryItem } from '../data/library';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { dropSong, patchSong, reloadSongs, useSongs, type SongRow, type SongStatus } from '../songs/store';
import { elements } from '../songs/structure';

/* Tananyag → Dalok: a Song Practice kezdőlapja a BEATHUBban. Fent a YouTube link (UPLOAD), alatta a dalok
   mappákba rendezve. A link egy 'queued' sor lesz; a gépen futó feldolgozó (start-worker.bat) veszi fel,
   és az állapota itt élőben látszik. A dalok egymás alatti sorok: a sorra kattintva a gyakorló oldal, a ceruzával
   a szerkesztő (ott van a közzététel, a mappa és a törlés is). A mappák a lista fölött; egy mappa a ?mappa= címen nyílik. */

const VIDEO_ID = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|live\/|shorts\/)|[?&]v=)([a-zA-Z0-9_-]{11})/;
const BUSY: SongStatus[] = ['queued', 'downloading', 'separating', 'analyzing'];
const STATUS: Record<SongStatus, [string, string]> = {
  queued: ['Sorban áll – a gépen futó feldolgozó veszi fel', 'Queued – waiting for the processor on your PC'],
  downloading: ['Letöltés', 'Downloading'],
  separating: ['Dob és band szétválasztása', 'Separating drums and band'],
  analyzing: ['Ütemek és szekciók keresése', 'Finding bars and sections'],
  done: ['Kész', 'Done'],
  error: ['Hiba', 'Error'],
};

export function SongsHub() {
  const { pick } = useI18n();
  const songs = useSongs();
  const { items } = useLibrary();
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [workerSeen, setWorkerSeen] = useState<number | null>(null);
  const library = pick('Tananyag', 'Library');
  const [params, setParams] = useSearchParams();
  const open = params.get('mappa');

  // a feldolgozás állapota élőben
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    const ch = db
      .channel('songs-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, (p) => {
        if (p.eventType === 'DELETE') dropSong((p.old as SongRow).id);
        else patchSong(p.new as SongRow);
      })
      .subscribe();
    void reloadSongs();
    return () => {
      void db.removeChannel(ch);
    };
  }, []);

  // él-e a feldolgozó a gépen (20 mp-enként jelez)
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    const check = () =>
      void db.from('worker_status').select('last_seen').maybeSingle().then(({ data }) =>
        setWorkerSeen(data ? new Date((data as { last_seen: string }).last_seen).getTime() : 0));
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);
  const workerUp = workerSeen !== null && Date.now() - workerSeen < 60000;
  const waiting = (songs ?? []).some((s) => BUSY.includes(s.status));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const vid = VIDEO_ID.exec(link)?.[1];
    if (!vid) return setMsg({ text: pick('Ez nem tűnik YouTube linknek.', 'This does not look like a YouTube link.'), err: true });
    const known = (songs ?? []).find((s) => s.video_id === vid || s.id === vid);
    if (known) return setMsg({ text: pick(`Ez a dal már bent van: ${known.title || vid}`, `This song is already here: ${known.title || vid}`) });
    const { data, error } = await supabase.from('songs').insert({ id: vid, video_id: vid, title: '', status: 'queued' }).select().single();
    if (error) return setMsg({ text: error.message, err: true });
    patchSong(data as SongRow);
    setLink('');
    setMsg(workerUp ? { text: pick('Sorba állítva.', 'Queued.') } : { text: pick('Sorba állítva. A feldolgozáshoz indítsd el a gépen a start-worker.bat-ot.', 'Queued. Start start-worker.bat on your PC to process it.') });
  };

  const folders = useMemo(() => [...new Set((songs ?? []).map((s) => s.folder).filter((f): f is string => !!f))].sort(), [songs]);
  const shown = (songs ?? []).filter((s) => (open ? s.folder === open : !s.folder));
  const exercisesOf = (id: string) => items.filter((x) => x.category === 'dalok' && x.song === id);

  return (
    <>
      <TopBar title={open ?? pick('Dalok', 'Songs')} backTo={open ? '/tananyag/dalok' : '/tananyag'} backLabel={open ? pick('Dalok', 'Songs') : library} />
      <main className="page song-hub">
        <form className="hub-upload" onSubmit={(e) => void submit(e)} autoComplete="off">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={pick('YouTube link', 'YouTube link')} aria-label="YouTube link" required />
          <button className="btn primary">{pick('Feldolgozás', 'Process')}</button>
        </form>
        {msg && <p className={msg.err ? 'error-box' : 'note-box'}>{msg.text}</p>}
        {workerSeen !== null && (waiting || !workerUp) && (
          <p className={`worker-state${workerUp ? ' up' : ''}`}>
            {workerUp
              ? pick('A feldolgozó fut a gépen.', 'The processor is running on your PC.')
              : pick('A feldolgozó most nem fut: a linkek sorban várnak, amíg a gépen el nem indítod a start-worker.bat-ot.', 'The processor is not running: links wait until you start start-worker.bat on your PC.')}
          </p>
        )}

        {!songs ? (
          <p className="muted">{pick('Betöltés…', 'Loading…')}</p>
        ) : (
          <div className="song-list">
            {!open &&
              folders.map((f) => (
                <button key={f} className="song-row folder" onClick={() => setParams({ mappa: f })}>
                  <span className="song-row-icon"><FolderIcon /></span>
                  <span className="song-row-text">
                    <b>{f}</b>
                    <small>{pick(`${songs.filter((s) => s.folder === f).length} dal`, `${songs.filter((s) => s.folder === f).length} songs`)}</small>
                  </span>
                </button>
              ))}
            {shown.map((s) => (
              <SongRowItem key={s.id} s={s} back={open ? `/tananyag/dalok?mappa=${encodeURIComponent(open)}` : '/tananyag/dalok'} exercises={exercisesOf(s.id)} />
            ))}
            {!shown.length && !(!open && folders.length) && (
              <p className="muted">{open ? pick('Ebben a mappában nincs dal.', 'This folder is empty.') : pick('Még nincs dal. Adj be fent egy YouTube linket.', 'No songs yet. Paste a YouTube link above.')}</p>
            )}
          </div>
        )}
        <p className="muted hub-foot">{pick(
            'A feldolgozás a gépeden fut (dob és band szétválasztása, ütemek, szekciók); a szerkesztés innen bárhonnan megy, és a közzétett dalt a diákok azonnal látják.',
            'Processing runs on your PC (drum and band separation, bars, sections); editing works from anywhere, and students see a published song at once.',
          )}</p>
      </main>
    </>
  );
}

/** egy dal sora: lejátszás gomb (a gyakorló oldal), cím és előadó, címkék, a végén ceruza (szerkesztő);
 *  feldolgozás közben az állapota; alatta behúzva a dalhoz készült gyakorlatok */
function SongRowItem({ s, back, exercises }: { s: SongRow; back: string; exercises: LibraryItem[] }) {
  const { pick, text } = useI18n();
  const ready = s.status === 'done' && !!s.structure;
  const title = s.title || s.video_id || s.id;
  const els = useMemo(() => (s.structure ? elements(s.structure, s.structure.patterns ?? {}) : []), [s.structure]);
  const fills = els.filter((e) => e.type === 'fill').length;
  const retry = async () => {
    if (!supabase) return;
    patchSong({ id: s.id, status: 'queued', progress: 0, error: null });
    await supabase.from('songs').update({ status: 'queued', progress: 0, error: null }).eq('id', s.id);
  };
  const body = (
    <>
      <span className="song-row-icon play"><PlayIcon size={20} /></span>
      <span className="song-row-text">
        <b>{title}</b>
        {s.artist && <small>{s.artist}</small>}
      </span>
      {ready && (
        <span className="song-row-tags">
          <i>{s.structure!.bpm} BPM</i>
          <i>4/4</i>
          {fills > 0 && <i className="fill">{fills} FILL</i>}
          {!s.published && <i className="draft">{pick('PISZKOZAT', 'DRAFT')}</i>}
        </span>
      )}
    </>
  );
  return (
    <>
      <div className="song-row-wrap">
        {ready ? (
          <Link className="song-row" to={songPath(s.id)} state={{ back }}>{body}</Link>
        ) : (
          <div className="song-row busy">
            <span className="song-row-icon play"><PlayIcon size={20} /></span>
            <span className="song-row-text">
              <b>{title}</b>
              <small>
                {pick(...STATUS[s.status])}
                {s.status !== 'queued' && s.status !== 'error' && ` · ${s.progress}%`}
                {s.error && ` · ${s.error}`}
              </small>
            </span>
            {s.status === 'error' && (
              <button className="btn small" onClick={() => void retry()}>{pick('Újra', 'Retry')}</button>
            )}
          </div>
        )}
        <Link className="song-row-edit" to={`/tananyag/dalok/${encodeURIComponent(s.id)}/szerkesztes`} state={{ back }} aria-label={`${pick('Szerkesztés', 'Edit')}: ${title}`}>
          <PencilIcon size={22} />
        </Link>
      </div>
      {exercises.map((x) => (
        <Link key={x.id} className="song-row sub" to={`/tananyag/dalok/${x.id}`}>
          <span className="song-row-text">
            <b>↳ {text(x.title)}</b>
            {x.subtitle && <small>{text(x.subtitle)}</small>}
          </span>
        </Link>
      ))}
    </>
  );
}
