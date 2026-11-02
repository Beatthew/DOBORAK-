import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MoneyIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';
import { tuition, type Attendance, type Billing, type Payment, type Tuition } from '../lib/billing';
import { supabase, type Profile } from '../lib/supabase';

interface Row extends Profile {
  lessons: number;
  last: string | null;
  /** Null, amíg nincs beállítva a tandíja. */
  tuition: (Tuition & { pack: boolean }) | null;
}

/** Az összes regisztrált diák, kereshetően, az órák számával és az utolsó óra dátumával. */
export function Students() {
  const { pick, locale } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [p, l, b, pay, a] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      supabase.from('lessons').select('student_id, date'),
      supabase.from('student_billing').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('attendance').select('student_id, date'),
    ]);
    const ls = (l.data as { student_id: string; date: string }[]) ?? [];
    const billing = (b.data as Billing[]) ?? [];
    const payments = (pay.data as Payment[]) ?? [];
    const visits = (a.data as Attendance[]) ?? [];
    setRows(
      ((p.data as Profile[]) ?? []).map((s) => {
        const mine = ls.filter((x) => x.student_id === s.id).map((x) => x.date).sort();
        const bill = billing.find((x) => x.student_id === s.id);
        return {
          ...s,
          lessons: mine.length,
          last: mine[mine.length - 1] ?? null,
          tuition: bill
            ? {
                ...tuition(bill.plan, payments.filter((x) => x.student_id === s.id), visits.filter((x) => x.student_id === s.id).length),
                pack: bill.plan === 'pack4',
              }
            : null,
        };
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
      <TopBar title={pick('Diákjaim', 'My students')} backTo="/" backLabel="BEATHUB">
        <input className="search" placeholder={pick('Keresés név szerint…', 'Search by name…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </TopBar>
      <main className="page">
        <button className="btn primary big" onClick={() => setAdding(!adding)}>
          {pick('+ Diák felvétele', '+ Add student')}
        </button>
        {adding && (
          <AddStudent
            onDone={() => {
              setAdding(false);
              void load();
            }}
          />
        )}
        {rows === null ? (
          <p className="muted">{pick('Betöltés…', 'Loading…')}</p>
        ) : !shown.length ? (
          <p className="muted">
            {rows.length
              ? pick('Nincs ilyen nevű diák.', 'No student with this name.')
              : pick('Még nincs regisztrált diák. Küldd el nekik az app linkjét: regisztráció után itt jelennek meg.', 'No registered students yet. Send them the app link: they appear here after signing up.')}
          </p>
        ) : (
          <div className="grid">
            {shown.map((s, i) => (
              <Link key={s.id} to={`/diak/${s.id}`} className={`lesson-card student-card tone-${i % 2}`}>
                {s.tuition?.due && (
                  <span className="pay-badge" role="img" title={pick('Fizetés esedékes', 'Payment due')} aria-label={pick('Fizetés esedékes', 'Payment due')}>
                    <MoneyIcon />
                  </span>
                )}
                <div className="lesson-card-num">{initials(s.full_name)}</div>
                <div className="lesson-card-text">
                  <div className="lesson-card-title">{s.full_name || pick('Névtelen diák', 'Unnamed student')}</div>
                  <div className="lesson-card-sub">
                    {s.lessons && s.last
                      ? pick(`${s.lessons} óra · utoljára ${new Date(s.last).toLocaleDateString(locale)}`, `${s.lessons} ${s.lessons === 1 ? 'lesson' : 'lessons'} · last ${new Date(s.last).toLocaleDateString(locale)}`)
                      : pick('még nincs óra', 'no lessons yet')}
                    {!s.user_id && (s.email ? pick(' · még nem regisztrált', ' · not signed up yet') : pick(' · nincs email', ' · no email'))}
                    {s.tuition?.pack && ` · ${pick('csomag', 'pack')} ${s.tuition.done}/${s.tuition.size}`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

/** Diák felvétele név + email alapján, még a regisztrációja előtt: amikor ezzel az email címmel regisztrál,
 *  a fiókja ehhez a profilhoz kapcsolódik, és mindent ott talál, amit addig kiadtál neki. */
function AddStudent({ onDone }: { onDone: () => void }) {
  const { pick } = useI18n();
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
    if (error) return alert(/duplicate|unique/i.test(error.message) ? pick('Ezzel az email címmel már van diák.', 'There is already a student with this email.') : error.message);
    onDone();
  };

  return (
    <form className="form card" onSubmit={submit}>
      <label>
        {pick('Név', 'Name')}
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {pick('Email (ezzel fog regisztrálni)', 'Email (they will sign up with this)')}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? pick('Mentés…', 'Saving…') : pick('Felvétel', 'Add')}
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
