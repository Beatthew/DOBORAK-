import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../auth';
import { supabase, type Profile } from '../lib/supabase';

interface Row extends Profile {
  lessons: number;
  last: string | null;
}

/** Tanári kezdőlap: az összes regisztrált diák, kereshetően, az órák számával és az utolsó óra dátumával. */
export function TeacherHome() {
  const { signOut } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [p, l] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      supabase.from('lessons').select('student_id, date'),
    ]);
    const ls = (l.data as { student_id: string; date: string }[]) ?? [];
    setRows(
      ((p.data as Profile[]) ?? []).map((s) => {
        const mine = ls.filter((x) => x.student_id === s.id).map((x) => x.date).sort();
        return { ...s, lessons: mine.length, last: mine[mine.length - 1] ?? null };
      }),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !n || r.full_name.toLowerCase().includes(n));
  }, [rows, q]);

  return (
    <>
      <TopBar title="Diákjaim">
        <input className="search" placeholder="Keresés név szerint…" value={q} onChange={(e) => setQ(e.target.value)} />
      </TopBar>
      <main className="page">
        <div className="row">
          <button className="btn primary" onClick={() => setAdding(!adding)}>
            + Diák felvétele
          </button>
        </div>
        {adding && (
          <AddStudent
            onDone={() => {
              setAdding(false);
              void load();
            }}
          />
        )}
        {rows === null ? (
          <p className="muted">Betöltés…</p>
        ) : !shown.length ? (
          <p className="muted">
            {rows.length
              ? 'Nincs ilyen nevű diák.'
              : 'Még nincs regisztrált diák. Küldd el nekik az app linkjét: regisztráció után itt jelennek meg.'}
          </p>
        ) : (
          <div className="stack">
            {shown.map((s, i) => (
              <Link key={s.id} to={`/diak/${s.id}`} className={`lesson-card tone-${i % 2}`}>
                <div className="lesson-card-num">{initials(s.full_name)}</div>
                <div className="lesson-card-text">
                  <div className="lesson-card-title">{s.full_name || 'Névtelen diák'}</div>
                  <div className="lesson-card-sub">
                    {s.lessons && s.last
                      ? `${s.lessons} óra · utoljára ${new Date(s.last).toLocaleDateString('hu-HU')}`
                      : 'még nincs óra'}
                    {!s.user_id && ' · még nem regisztrált'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="row">
          <Link className="btn ghost" to="/gyakorlatok">
            Dobórák
          </Link>
          <a className="btn ghost" href="./dalok/">
            Dalok
          </a>
          <button className="btn ghost" onClick={() => void signOut()}>
            Kilépés
          </button>
        </div>
      </main>
    </>
  );
}

/** Diák felvétele név + email alapján, még a regisztrációja előtt: amikor ezzel az email címmel regisztrál,
 *  a fiókja ehhez a profilhoz kapcsolódik, és mindent ott talál, amit addig kiadtál neki. */
function AddStudent({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .insert({ full_name: name.trim(), email: email.trim().toLowerCase(), role: 'student' });
    setBusy(false);
    if (error) return alert(/duplicate|unique/i.test(error.message) ? 'Ezzel az email címmel már van diák.' : error.message);
    onDone();
  };

  return (
    <form className="form card" onSubmit={submit}>
      <label>
        Név
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Email (ezzel fog regisztrálni)
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Mentés…' : 'Felvétel'}
      </button>
    </form>
  );
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';
