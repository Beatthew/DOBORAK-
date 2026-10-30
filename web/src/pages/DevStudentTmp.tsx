import { MaterialTile } from '../components/MaterialTile';
import { TopBar } from '../components/TopBar';
import type { LessonRow, Material } from '../lib/supabase';
import { MyLessons } from './StudentHome';

const l = (id: string, date: string, doborak: string | null): LessonRow => ({ id, student_id: 's', date, title: '', notes: '', doborak, created_at: date });
const m = (id: string, x: Partial<Material>) => ({ id, student_id: 's', lesson_id: 'x', kind: 'song', title: '', ref: null, file_path: null, file_name: null, link_url: null, note: '', created_at: '2026-10-22', ...x }) as Material;

export function DevStudentTmp() {
  return (
    <>
      <TopBar title="Kovács Anna" />
      <main className="page">
        <MyLessons lessons={[l('c', '2026-10-29', null), l('b', '2026-10-22', null), l('a', '2026-10-15', null)]} materials={[]} />
        <div className="grid">
          <MaterialTile tone={0} m={m('1', { ref: 'come-together', note: '75%-os tempóról indulj.' })} />
          <MaterialTile tone={1} m={m('2', { kind: 'material', title: 'Órai kotta', file_path: 'x.pdf', file_name: 'shuffle-kotta.pdf' })} />
          <MaterialTile tone={0} m={m('3', { kind: 'exercise', ref: '1' })} />
        </div>
        <button className="btn ghost signout full">Kilépés</button>
      </main>
    </>
  );
}
