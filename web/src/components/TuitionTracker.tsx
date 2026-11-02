import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { formatFt, localToday, PLAN_SIZE, tuition, type Attendance, type Billing, type Payment, type Plan } from '../lib/billing';
import { supabase } from '../lib/supabase';
import { MoneyIcon, PencilIcon } from './Icons';

/** Egy diák tandíja a tanár szemével: hányadik órájánál tart, "JÖTT MA" gomb, befizetések rögzítése. */
export function TuitionTracker({ studentId }: { studentId: string }) {
  const { pick, locale } = useI18n();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [visits, setVisits] = useState<Attendance[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState<'settings' | 'pay' | null>(null);
  const [busy, setBusy] = useState(false);
  const [otherDay, setOtherDay] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const [b, p, a] = await Promise.all([
      supabase.from('student_billing').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('payments').select('*').eq('student_id', studentId).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('attendance').select('student_id, date').eq('student_id', studentId).order('date', { ascending: false }),
    ]);
    setFailed(Boolean(b.error || p.error || a.error));
    setBilling((b.data as Billing) ?? null);
    setPayments((p.data as Payment[]) ?? []);
    setVisits((a.data as Attendance[]) ?? []);
    setReady(true);
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addVisit = async (date: string) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('attendance').upsert({ student_id: studentId, date }, { onConflict: 'student_id,date', ignoreDuplicates: true });
    if (error) alert(error.message);
    await load();
    setBusy(false);
  };
  const removeVisit = async (date: string) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('attendance').delete().eq('student_id', studentId).eq('date', date);
    if (error) alert(error.message);
    await load();
    setBusy(false);
  };
  const removePayment = async (p: Payment) => {
    if (!supabase || !confirm(`${pick('Törlöd ezt a befizetést', 'Delete this payment')}: ${formatFt(p.amount)}?`)) return;
    const { error } = await supabase.from('payments').delete().eq('id', p.id);
    if (error) alert(error.message);
    void load();
  };
  const panelDone = () => {
    setPanel(null);
    void load();
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale);

  if (!ready) return null;
  if (failed)
    return <p className="error-box">{pick('A tandíjadatok nem tölthetők be. Lefutott már a 010_tandij.sql?', 'Tuition data could not be loaded. Has 010_tandij.sql been run?')}</p>;
  if (!billing)
    return (
      <section className="tuition">
        <h2 className="tuition-title">{pick('Tandíj beállítása', 'Set up tuition')}</h2>
        <TuitionSettings studentId={studentId} billing={null} onDone={panelDone} />
      </section>
    );

  const t = tuition(billing.plan, payments, visits.length);
  const pack = billing.plan === 'pack4';
  const unpaid = Math.max(0, -t.left);
  const today = localToday();
  const cameToday = visits.some((v) => v.date === today);
  const last = payments[0];

  const status = pack
    ? unpaid
      ? pick(`Lejárt, és ${unpaid} óra még nincs kifizetve`, `Finished, and ${unpaid} ${unpaid === 1 ? 'lesson is' : 'lessons are'} unpaid`)
      : t.left === 0
        ? pick('Lejárt a csomag', 'Pack finished')
        : t.left === 1
          ? pick('Most jön az utolsó órája', 'Last lesson coming up')
          : pick(`Még ${t.left} óra van hátra`, `${t.left} lessons left`)
    : unpaid
      ? pick(`${unpaid} óra kifizetetlen · ${formatFt(unpaid * billing.price)}`, `${unpaid} unpaid ${unpaid === 1 ? 'lesson' : 'lessons'} · ${formatFt(unpaid * billing.price)}`)
      : pick('Minden óra kifizetve', 'All lessons paid');

  return (
    <section className={`tuition${t.due ? ' is-due' : ''}`}>
      <div className="tuition-head">
        <span className="tuition-plan">
          {pack ? pick('4 órás csomag', '4-lesson pack') : pick('Alkalmanként', 'Per lesson')} · {formatFt(billing.price)}/{pick('óra', 'lesson')}
        </span>
        <button
          className="tuition-edit"
          aria-label={pick('Csomag és óradíj módosítása', 'Change plan and price')}
          aria-expanded={panel === 'settings'}
          onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
        >
          <PencilIcon size={16} />
        </button>
      </div>

      {panel === 'settings' && <TuitionSettings studentId={studentId} billing={billing} onDone={panelDone} />}

      {pack && (
        <div className="tuition-progress" role="img" aria-label={`${t.done}/${t.size}`}>
          <div className="tuition-count">
            {t.done}
            <span>/{t.size}</span>
          </div>
          <div className="tuition-bar">
            {Array.from({ length: t.size }, (_, i) => (
              <span key={i} className={i < t.done ? 'on' : ''} />
            ))}
          </div>
        </div>
      )}
      <p className="tuition-status">{status}</p>

      {cameToday ? (
        <div className="tuition-came done">
          <span>✓ {pick('Ma itt volt', 'Here today')}</span>
          <button className="btn small" disabled={busy} onClick={() => void removeVisit(today)}>
            {pick('Visszavonás', 'Undo')}
          </button>
        </div>
      ) : (
        <button className="tuition-came" disabled={busy} onClick={() => void addVisit(today)}>
          {pick('JÖTT MA', 'CAME TODAY')}
        </button>
      )}

      <button className={`btn big tuition-pay${t.due ? ' primary' : ' ghost'}`} onClick={() => setPanel(panel === 'pay' ? null : 'pay')}>
        <MoneyIcon size={20} />
        {pick('Befizetés rögzítése', 'Record a payment')}
      </button>
      {panel === 'pay' && (
        <PaymentForm studentId={studentId} billing={billing} unpaid={unpaid} first={!payments.length} onDone={panelDone} />
      )}

      {last ? (
        <p className="tuition-last">
          {pick('Utolsó befizetés', 'Last payment')}: {fmtDate(last.date)} · {formatFt(last.amount)}
        </p>
      ) : (
        <p className="tuition-last">{pick('Még nincs rögzített befizetés.', 'No payment recorded yet.')}</p>
      )}

      <details className="tuition-history">
        <summary>{pick('Előzmények', 'History')}</summary>
        <h3>{pick('Befizetések', 'Payments')}</h3>
        {payments.length ? (
          <ul>
            {payments.map((p) => (
              <li key={p.id}>
                <span>
                  {fmtDate(p.date)} · {formatFt(p.amount)} · {p.lessons} {pick('óra', p.lessons === 1 ? 'lesson' : 'lessons')}
                </span>
                <button aria-label={pick('Befizetés törlése', 'Delete payment')} onClick={() => void removePayment(p)}>×</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{pick('Még nincs.', 'None yet.')}</p>
        )}
        <h3>{pick('Megtartott órák', 'Lessons attended')}</h3>
        {visits.length ? (
          <ul>
            {visits.map((v) => (
              <li key={v.date}>
                <span>{fmtDate(v.date)}</span>
                <button aria-label={pick('Óra törlése', 'Delete lesson')} disabled={busy} onClick={() => void removeVisit(v.date)}>×</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{pick('Még nincs.', 'None yet.')}</p>
        )}
        <form
          className="form tuition-otherday"
          onSubmit={(e) => {
            e.preventDefault();
            void addVisit(otherDay);
            setOtherDay('');
          }}
        >
          <label>
            {pick('Elfelejtetted jelölni? Másik nap', 'Forgot to mark it? Another day')}
            <input required type="date" max={today} value={otherDay} onChange={(e) => setOtherDay(e.target.value)} />
          </label>
          <button className="btn" disabled={busy || !otherDay}>{pick('Hozzáadás', 'Add')}</button>
        </form>
      </details>
    </section>
  );
}

function TuitionSettings({ studentId, billing, onDone }: { studentId: string; billing: Billing | null; onDone: () => void }) {
  const { pick } = useI18n();
  const [plan, setPlan] = useState<Plan>(billing?.plan ?? 'pack4');
  const [price, setPrice] = useState(String(billing?.price ?? 10000));
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('student_billing').upsert({ student_id: studentId, plan, price: Number(price) });
    setBusy(false);
    if (error) return alert(error.message);
    onDone();
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="seg two">
        {(
          [
            ['pack4', pick('4 órás csomag', '4-lesson pack')],
            ['single', pick('Alkalmanként', 'Per lesson')],
          ] as [Plan, string][]
        ).map(([p, label]) => (
          <button type="button" key={p} className={p === plan ? 'on' : ''} onClick={() => setPlan(p)}>
            {label}
          </button>
        ))}
      </div>
      <label>
        {pick('Óradíj (Ft)', 'Price per lesson (Ft)')}
        <input required type="number" inputMode="numeric" min={0} step={500} value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy}>
        {busy ? pick('Mentés…', 'Saving…') : pick('Mentés', 'Save')}
      </button>
    </form>
  );
}

interface PaymentFormProps {
  studentId: string;
  billing: Billing;
  unpaid: number;
  /** Az első befizetésnél megadható, hány órát járt már le belőle (ha a csomag a követő előtt indult). */
  first: boolean;
  onDone: () => void;
}

function PaymentForm({ studentId, billing, unpaid, first, onDone }: PaymentFormProps) {
  const { pick } = useI18n();
  const lessons = billing.plan === 'pack4' ? PLAN_SIZE.pack4 : Math.max(1, unpaid);
  const [date, setDate] = useState(localToday());
  const [amount, setAmount] = useState(String(lessons * billing.price));
  const [usedBefore, setUsedBefore] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase
      .from('payments')
      .insert({ student_id: studentId, date, amount: Number(amount), lessons, used_before: usedBefore });
    setBusy(false);
    if (error) return alert(error.message);
    onDone();
  };

  return (
    <form className="form tuition-payform" onSubmit={submit}>
      <label>
        {pick('Összeg (Ft)', 'Amount (Ft)')} · {lessons} {pick('óra', lessons === 1 ? 'lesson' : 'lessons')}
        <input required type="number" inputMode="numeric" min={0} step={500} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        {pick('Mikor fizetett', 'Paid on')}
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {first && billing.plan === 'pack4' && (
        <div className="form-group">
          <span className="form-label">{pick('Ebből már lejárt', 'Already attended')}</span>
          <div className="seg four">
            {[0, 1, 2, 3].map((n) => (
              <button type="button" key={n} className={n === usedBefore ? 'on' : ''} onClick={() => setUsedBefore(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="btn primary" disabled={busy}>
        {busy ? pick('Mentés…', 'Saving…') : pick('Befizetés mentése', 'Save payment')}
      </button>
    </form>
  );
}
