import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { MISSING_TABLES, useLibrary } from '../data/library';
import { lessons } from '../data/lessons';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { SONGS } from '../songs';

/** A tananyag kategóriái; a lista az appból bővíthető. */
export function Library() {
  const { pick, text } = useI18n();
  const { categories, items, reload } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !name.trim()) return;
    const { error } = await supabase.from('library_categories').insert({ name: name.trim() });
    if (error) return alert(/library_categories/.test(error.message) ? text(MISSING_TABLES) : error.message);
    setName('');
    setAdding(false);
    void reload();
  };

  const count = (id: string) => (id === 'dalok' ? SONGS.length : items.filter((i) => i.category === id).length);

  return (
    <>
      <TopBar title={pick('Tananyag', 'Library')} backTo="/" backLabel="BEATHUB" />
      <main className="page">
        <div className="tile-grid">
          {categories.map((c, i) => (
            <Link key={c.id} className={`cat-tile tone-${(i + (i >> 1)) % 2}`} to={`/tananyag/${c.id}`}>
              <span className="cat-tile-name">{text(c.name)}</span>
              <span className="cat-tile-sub">{count(c.id) ? pick(`${count(c.id)} tétel`, `${count(c.id)} ${count(c.id) === 1 ? 'item' : 'items'}`) : pick('még üres', 'empty')}</span>
            </Link>
          ))}
          {adding ? (
            <form className="cat-tile add-tile add-form" onSubmit={add}>
              <input autoFocus required placeholder={pick('Az új típus neve', 'Name of the new type')} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn primary">{pick('Hozzáadás', 'Add')}</button>
            </form>
          ) : (
            <button className="cat-tile add-tile" onClick={() => setAdding(true)}>
              <span className="add-plus">+</span>
              <span className="cat-tile-name">{pick('Tananyag típus hozzáadása', 'Add a library type')}</span>
            </button>
          )}
        </div>
        <Link className="btn ghost big" to="/gyakorlatok">
          {pick('Kész órák', 'Ready-made lessons')} ({lessons.length})
        </Link>
      </main>
    </>
  );
}
