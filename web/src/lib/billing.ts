export type Plan = 'single' | 'pack4';

export const PLAN_SIZE: Record<Plan, number> = { single: 1, pack4: 4 };

export interface Billing {
  student_id: string;
  plan: Plan;
  price: number;
}

export interface Payment {
  id: string;
  student_id: string;
  date: string;
  amount: number;
  /** Hány órát fedez ez a befizetés. */
  lessons: number;
  /** Ebből hány volt már lejárva, amikor a követő indult. */
  used_before: number;
  created_at: string;
}

export interface Attendance {
  student_id: string;
  date: string;
}

export interface Tuition {
  /** A mostani csomag mérete és abból a lejárt órák száma. */
  size: number;
  done: number;
  /** Még kifizetett órák száma; negatív, ha több órán volt, mint amennyit fizetett. */
  left: number;
  /** Fizetés esedékes: a csomagból legfeljebb egy óra maradt, alkalmanként fizetőnél kifizetetlen óra van. */
  due: boolean;
}

/** A befizetések sorban fogynak: a legrégebbi csomag telik meg először, a kifizetetlen óra a következő befizetésbe számít bele. */
export function tuition(plan: Plan, payments: Payment[], visits: number): Tuition {
  const paid = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const used = visits + paid.reduce((sum, p) => sum + p.used_before, 0);
  const left = paid.reduce((sum, p) => sum + p.lessons, 0) - used;
  const due = plan === 'pack4' ? left <= 1 : left < 0;
  let rest = used;
  for (const p of paid) {
    if (rest < p.lessons) return { size: p.lessons, done: rest, left, due };
    rest -= p.lessons;
  }
  const size = PLAN_SIZE[plan];
  return { size, done: paid.length ? size : Math.min(used, size), left, due };
}

export const formatFt = (n: number) => `${n.toLocaleString('hu-HU')} Ft`;

/** A mai nap a helyi idő szerint (a toISOString UTC-ben számolna). */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
