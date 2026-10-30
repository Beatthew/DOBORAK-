import { useState, type FormEvent } from 'react';
import { Brand, TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';

/** Belépés / regisztráció email + jelszóval. Az új fiók diákként jön létre; a tanári szerepet a tanár kapja meg. */
export function Login() {
  const { pick } = useI18n();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!supabase) {
    return (
      <>
        <TopBar title={<Brand />} hideName />
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
      setMsg({ ok: false, text: errorText(res.error.message, pick) });
      return;
    }
    if (mode === 'up' && !res.data.session) setMsg({ ok: true, text: pick('Kész! Nézd meg az emailed, és kattints a megerősítő linkre, utána be tudsz lépni.', 'Done! Check your email and click the confirmation link, then you can sign in.') });
  };

  return (
    <>
      <TopBar title={<Brand />} hideName>
        <p className="top-sub">{mode === 'in' ? pick('Belépés', 'Sign in') : pick('Regisztráció', 'Sign up')}</p>
      </TopBar>
      <main className="page">
        <form className="form" onSubmit={submit}>
          {mode === 'up' && (
            <label>
              {pick('Teljes neved', 'Your full name')}
              <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            {pick('Jelszó', 'Password')}
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
            {busy ? '…' : mode === 'in' ? pick('Belépés', 'Sign in') : pick('Regisztráció', 'Sign up')}
          </button>
          <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
            {mode === 'in' ? pick('Még nincs fiókom – regisztrálok', 'No account yet – sign up') : pick('Már van fiókom – belépek', 'I already have an account – sign in')}
          </button>
        </form>
      </main>
    </>
  );
}

function errorText(m: string, pick: (hu: string, en: string) => string) {
  if (/invalid login/i.test(m)) return pick('Hibás email vagy jelszó.', 'Wrong email or password.');
  if (/not confirmed/i.test(m)) return pick('Még nem erősítetted meg az email címed – nézd meg a leveleid.', 'You have not confirmed your email yet – check your inbox.');
  if (/already registered/i.test(m)) return pick('Ezzel az email címmel már van fiók – lépj be.', 'This email already has an account – sign in.');
  if (/at least 6/i.test(m)) return pick('A jelszó legalább 6 karakter legyen.', 'The password must be at least 6 characters.');
  return m;
}
