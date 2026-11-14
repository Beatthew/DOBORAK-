import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipPlayer, StoredClipPlayer } from '../components/ClipPlayer';
import { GearQuiz } from '../components/GearQuiz';
import { KickPermutations } from '../components/KickPermutations';
import { VoiceSplit } from '../components/VoiceSplit';
import { RhythmScale } from '../components/RhythmScale';
import { ScorePlayer } from '../components/Score';
import { StrokesLesson } from '../components/Strokes';
import { TopBar } from '../components/TopBar';
import { toBeats, useLibrary } from '../data/library';
import { GEAR_REF } from '../data/gear';
import { KICK_PERMS_REF } from '../data/kickPermutations';
import { VOICE_SPLIT_REF } from '../data/voiceSplit';
import { RHYTHM_SCALE_REF } from '../data/rhythmScale';
import { STROKES_REF } from '../data/strokes';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { findClip } from '../songs/clips';

/** Egy tétel: visszahallgatható kotta, és ha képről készült, az eredeti kép. */
export function LibraryItem() {
  const { pick, text } = useI18n();
  const { cat = '', item: itemId = '' } = useParams();
  const nav = useNavigate();
  const { categories, items, ready } = useLibrary();
  const item = items.find((i) => i.id === itemId && i.category === cat);
  const backLabel = text(categories.find((c) => c.id === cat)?.name ?? 'Tananyag');
  const bars = useMemo(() => (item?.bars ?? []).map(toBeats), [item]);
  const clip = findClip(`${cat}/${itemId}`);
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
          <p className="muted">{ready ? pick('Ez a tétel nem található.', 'This item does not exist.') : pick('Betöltés…', 'Loading…')}</p>
        </main>
      </>
    );
  }

  const remove = async () => {
    if (!supabase || !confirm(`${pick('Törlöd', 'Delete')}: ${text(item.title)}?`)) return;
    if (item.image_path) await supabase.storage.from('materials').remove([item.image_path]);
    const { error } = await supabase.from('library_items').delete().eq('id', item.id);
    if (error) return alert(error.message);
    nav(`/tananyag/${cat}`, { replace: true });
  };

  if (`${item.category}/${item.id}` === STROKES_REF) {
    return (
      <>
        <TopBar title={text(item.title)} backTo={`/tananyag/${cat}`} backLabel={backLabel}>
          <p className="top-sub">{text(item.subtitle)}</p>
        </TopBar>
        <main className="page">
          <StrokesLesson />
        </main>
      </>
    );
  }

  if (`${item.category}/${item.id}` === KICK_PERMS_REF || `${item.category}/${item.id}` === VOICE_SPLIT_REF || `${item.category}/${item.id}` === RHYTHM_SCALE_REF) {
    return (
      <>
        <TopBar title={text(item.title)} backTo={`/tananyag/${cat}`} backLabel={backLabel}>
          <p className="top-sub">{text(item.subtitle)}</p>
        </TopBar>
        <main className="page">
          {`${item.category}/${item.id}` === VOICE_SPLIT_REF ? <VoiceSplit /> : `${item.category}/${item.id}` === RHYTHM_SCALE_REF ? <RhythmScale /> : <KickPermutations />}
        </main>
      </>
    );
  }

  if (`${item.category}/${item.id}` === GEAR_REF) {
    return (
      <>
        <TopBar title={text(item.title)} backTo={`/tananyag/${cat}`} backLabel={backLabel}>
          <p className="top-sub">{text(item.subtitle)}</p>
        </TopBar>
        <main className="page">
          <GearQuiz />
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={text(item.title)} backTo={`/tananyag/${cat}`} backLabel={backLabel}>
        {item.subtitle && <p className="top-sub">{text(item.subtitle)}</p>}
      </TopBar>
      <main className="page">
        {item.clip ? (
          <StoredClipPlayer clip={item.clip} title={text(item.title)} bpm={item.bpm} main={bars} />
        ) : clip ? (
          <ClipPlayer clip={clip} />
        ) : bars.length > 0 ? (
          <ScorePlayer id={item.id} bars={bars} bpm={bpm} onBpm={setBpm} min={item.bpm_min} max={item.bpm_max} />
        ) : (
          <p className="note-box">{pick('Ez a tétel még nincs átírva kottára.', 'This item has not been transcribed yet.')}</p>
        )}
        {item.note && <p className="muted">{text(item.note)}</p>}
        {image &&
          (/\.pdf$/i.test(item.file_name ?? '') ? (
            <a className="btn ghost big" href={image} target="_blank" rel="noreferrer">
              {pick('Eredeti kotta', 'Original score')}: {item.file_name}
            </a>
          ) : (
            <img className="source-image" src={image} alt={`${pick('Eredeti kotta', 'Original score')}: ${text(item.title)}`} />
          ))}
        <div className="action-row">
          {item.builtin ? (
            <Link className="btn ghost big" to={`/tananyag/${cat}/uj`} state={{ copyOf: item }}>
              {pick('Másolat készítése', 'Make a copy')}
            </Link>
          ) : (
            <>
              <Link className="btn primary big" to={`/tananyag/${cat}/${item.id}/szerkesztes`}>
                {pick('Szerkesztés', 'Edit')}
              </Link>
              <Link className="btn ghost big" to={`/tananyag/${cat}/uj`} state={{ copyOf: item }}>
                {pick('Másolat', 'Copy')}
              </Link>
              <button className="btn ghost big" onClick={() => void remove()}>
                {pick('Törlés', 'Delete')}
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
