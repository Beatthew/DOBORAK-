import { useState, type FormEvent } from 'react';
import { TopBar } from '../components/TopBar';
import { supabase } from '../lib/supabase';

/** Belépés / regisztráció email + jelszóval. Az új fiók diákként jön létre; a tanári szerepet a tanár kapja meg. */
export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!supabase) {
    return (
      <>
        <TopBar title="Belépés" />
        <main className="page">
          <p className="note-box">
            Az app még nincs összekötve a Supabase-zel. Töltsd ki a <b>web/.env.local</b> fájlt
            (minta: <b>web/.env.example</b>), majd indítsd újra.
          </p>
        </main>
      </>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === 'in'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    setBusy(false);
    if (res.error) {
      setMsg({ ok: false, text: errorText(res.error.message) });
      return;
    }
    if (mode === 'up' && !res.data.session) setMsg({ ok: true, text: 'Kész! Nézd meg az emailed, és kattints a megerősítő linkre, utána be tudsz lépni.' });
  };

  return (
    <>
      <TopBar title={mode === 'in' ? 'Belépés' : 'Regisztráció'} />
      <main className="page">
        <form className="form" onSubmit={submit}>
          {mode === 'up' && (
            <label>
              Teljes neved
              <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            Jelszó
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </label>
          {msg && <p className={msg.ok ? 'note-box' : 'error-box'}>{msg.text}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? '…' : mode === 'in' ? 'Belépés' : 'Regisztráció'}
          </button>
          <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
            {mode === 'in' ? 'Még nincs fiókom – regisztrálok' : 'Már van fiókom – belépek'}
          </button>
        </form>
      </main>
    </>
  );
}

function errorText(m: string) {
  if (/invalid login/i.test(m)) return 'Hibás email vagy jelszó.';
  if (/not confirmed/i.test(m)) return 'Még nem erősítetted meg az email címed – nézd meg a leveleid.';
  if (/already registered/i.test(m)) return 'Ezzel az email címmel már van fiók – lépj be.';
  if (/at least 6/i.test(m)) return 'A jelszó legalább 6 karakter legyen.';
  return m;
}
