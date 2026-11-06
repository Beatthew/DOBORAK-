import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { songPath } from '../data/catalog';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { coverUrl, dropSong, patchSong, reloadSongs, songSummary, useSongs, type SongRow, type SongStatus } from '../songs/store';

/* Tananyag → Dalok: a Song Practice kezdőlapja a BEATHUBban. Fent a YouTube link (UPLOAD), alatta a dalok
   mappákba rendezve. A link egy 'queued' sor lesz; a gépen futó feldolgozó (start-worker.bat) veszi fel,
   és az állapota itt élőben látszik. Kész dal: gyakorlás vagy szerkesztés. */

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
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [workerSeen, setWorkerSeen] = useState<number | null>(null);
  const library = pick('Tananyag', 'Library');

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
  const loose = (songs ?? []).filter((s) => !s.folder);

  return (
    <>
      <TopBar title={pick('Dalok', 'Songs')} backTo="/tananyag" backLabel={library} />
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
          <>
            {folders.map((f) => (
              <section key={f} className="hub-folder">
                <h2>{f}</h2>
                <SongGrid songs={songs.filter((s) => s.folder === f)} folders={folders} />
              </section>
            ))}
            {(loose.length > 0 || !folders.length) && (
              <section className="hub-folder">
                {folders.length > 0 && <h2>{pick('Többi dal', 'Other songs')}</h2>}
                {loose.length ? <SongGrid songs={loose} folders={folders} /> : <p className="muted">{pick('Még nincs dal. Adj be fent egy YouTube linket.', 'No songs yet. Paste a YouTube link above.')}</p>}
              </section>
            )}
          </>
        )}
        <p className="muted hub-foot">{pick(
            'A feldolgozás a gépeden fut (dob és band szétválasztása, ütemek, szekciók); a szerkesztés innen bárhonnan megy, és a közzétett dalt a diákok azonnal látják.',
            'Processing runs on your PC (drum and band separation, bars, sections); editing works from anywhere, and students see a published song at once.',
          )}</p>
      </main>
    </>
  );
}

function SongGrid({ songs, folders }: { songs: SongRow[]; folders: string[] }) {
  return (
    <div className="hub-grid">
      {songs.map((s, i) => (
        <SongCard key={s.id} s={s} tone={i % 2} folders={folders} />
      ))}
    </div>
  );
}

function SongCard({ s, tone, folders }: { s: SongRow; tone: number; folders: string[] }) {
  const { pick } = useI18n();
  const cover = coverUrl(s);
  const ready = s.status === 'done' && !!s.structure;
  const title = s.title || s.video_id || s.id;

  const update = async (fields: Partial<SongRow>) => {
    if (!supabase) return;
    patchSong({ id: s.id, ...fields });
    const { error } = await supabase.from('songs').update(fields).eq('id', s.id);
    if (error) {
      alert(error.message);
      void reloadSongs();
    }
  };
  const move = (v: string) => {
    if (v === '+') {
      const name = prompt(pick('Az új mappa neve:', 'New folder name:'))?.trim().slice(0, 60);
      if (name) void update({ folder: name });
    } else void update({ folder: v || null });
  };
  const remove = async () => {
    if (!supabase || !confirm(pick(`Törlöd: ${title}? (A sávjai is törlődnek; az órákhoz csatolt hivatkozások nem nyílnak meg többé.)`, `Delete ${title}? (Its tracks are deleted too; lessons linking to it will no longer open it.)`))) return;
    await supabase.storage.from('songs').remove([`${s.id}/drums.mp3`, `${s.id}/band.mp3`]);
    const { error } = await supabase.from('songs').delete().eq('id', s.id);
    if (error) return alert(error.message);
    dropSong(s.id);
  };

  return (
    <article className={`hub-card tone-${tone}`}>
      {cover ? <img className="hub-cover" src={cover} alt="" loading="lazy" /> : <span className="hub-cover none" aria-hidden="true">♪</span>}
      <div className="hub-body">
        <div className="lesson-card-title">{title}</div>
        <div className="lesson-card-sub">{ready ? songSummary(s) : s.artist}</div>
        {s.status !== 'done' && (
          <div className="hub-status">
            <span>{pick(...STATUS[s.status])}{s.status !== 'queued' && s.status !== 'error' && ` · ${s.progress}%`}</span>
            {s.status !== 'error' && s.status !== 'queued' && (
              <span className="hub-progress"><span style={{ width: `${s.status === 'downloading' ? s.progress : s.status === 'separating' ? 50 : 85}%` }} /></span>
            )}
            {s.error && <small>{s.error}</small>}
          </div>
        )}
        <div className="hub-actions">
          {ready && (
            <>
              <Link className="btn small primary" to={songPath(s.id)} state={{ back: '/tananyag/dalok' }}>
                {pick('Gyakorlás', 'Practice')}
              </Link>
              <Link className="btn small" to={`/tananyag/dalok/${encodeURIComponent(s.id)}/szerkesztes`}>
                {pick('Szerkesztés', 'Edit')}
              </Link>
              <button className={`btn small pub${s.published ? ' on' : ''}`} onClick={() => void update({ published: !s.published })} aria-pressed={s.published}>
                {s.published ? pick('Közzétéve', 'Published') : pick('Piszkozat', 'Draft')}
              </button>
            </>
          )}
          {s.status === 'error' && (
            <button className="btn small" onClick={() => void update({ status: 'queued', progress: 0, error: null })}>
              {pick('Újra', 'Retry')}
            </button>
          )}
          <select className="hub-folder-pick" value={s.folder ?? ''} onChange={(e) => move(e.target.value)} aria-label={pick('Mappa', 'Folder')}>
            <option value="">{pick('Nincs mappában', 'No folder')}</option>
            {folders.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
            <option value="+">{pick('+ Új mappa…', '+ New folder…')}</option>
          </select>
          <button className="btn small ghost" onClick={() => void remove()} disabled={s.status !== 'done' && s.status !== 'error' && s.status !== 'queued'}>
            {pick('Törlés', 'Delete')}
          </button>
        </div>
      </div>
    </article>
  );
}
