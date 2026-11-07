import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';

interface Note {
  id: string;
  body: string;
  created_at: string;
}

/** A tanár jegyzetei egy diákhoz (mi történt az órán, mire készüljön): a diák oldalán, az órák fölött.
 *  A legfrissebb elöl; egy jegyzetre kattintva szerkeszthető. Csak a tanár látja (supabase/014_diak_jegyzetek.sql). */
export function StudentNotes({ studentId }: { studentId: string }) {
  const { pick, locale } = useI18n();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('student_notes').select('id, body, created_at').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) setErr(error.message);
    setNotes((data as Note[]) ?? []);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !draft.trim()) return;
    const { error } = await supabase.from('student_notes').insert({ student_id: studentId, body: draft.trim() });
    if (error) return setErr(error.message);
    setDraft('');
    void load();
  };
  const save = async () => {
    if (!supabase || !editing) return;
    const { error } = await supabase.from('student_notes').update({ body: editing.body.trim() }).eq('id', editing.id);
    if (error) return setErr(error.message);
    setEditing(null);
    void load();
  };
  const remove = async (n: Note) => {
    if (!supabase || !confirm(pick('Törlöd ezt a jegyzetet?', 'Delete this note?'))) return;
    await supabase.from('student_notes').delete().eq('id', n.id);
    void load();
  };

  const date = (s: string) => new Date(s).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <section className="notes">
      <h2 className="group-title">{pick('Jegyzetek', 'Notes')}</h2>
      <form className="notes-add" onSubmit={(e) => void add(e)}>
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={pick('Mi történt az órán, mire készüljön a következőre…', 'What happened in the lesson, what to prepare for next time…')}
        />
        <button className="btn primary" disabled={!draft.trim()}>
          {pick('Jegyzet mentése', 'Save note')}
        </button>
      </form>
      {err && <p className="error-box">{err}</p>}
      {notes?.map((n) =>
        editing?.id === n.id ? (
          <div key={n.id} className="note-card editing">
            <small>{date(n.created_at)}</small>
            <textarea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} autoFocus />
            <div className="note-actions">
              <button className="btn small primary" onClick={() => void save()}>{pick('Mentés', 'Save')}</button>
              <button className="btn small" onClick={() => setEditing(null)}>{pick('Mégse', 'Cancel')}</button>
            </div>
          </div>
        ) : (
          <div key={n.id} className="note-card">
            <small>{date(n.created_at)}</small>
            <p>{n.body}</p>
            <div className="note-actions">
              <button className="btn small" onClick={() => setEditing({ id: n.id, body: n.body })}>{pick('Szerkesztés', 'Edit')}</button>
              <button className="btn small ghost" onClick={() => void remove(n)}>{pick('Törlés', 'Delete')}</button>
            </div>
          </div>
        ),
      )}
    </section>
  );
}
