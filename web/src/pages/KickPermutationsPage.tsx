import { useLocation } from 'react-router-dom';
import { KickPermutations } from '../components/KickPermutations';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';

/** A lábdob permutációk kiadott anyagként megnyitva: a diák nem látja a tananyag oldalait, ezért saját útvonala van. */
export function KickPermutationsPage() {
  const { pick, text } = useI18n();
  const { state } = useLocation() as { state?: { back?: string } };
  return (
    <>
      <TopBar title={text('Lábdob permutációk')} backTo={state?.back ?? '/'} backLabel={pick('Vissza', 'Back')}>
        <p className="top-sub">{text('Függetlenítés: 15 lábdob-ritmus egy groove alá')}</p>
      </TopBar>
      <main className="page">
        <KickPermutations />
      </main>
    </>
  );
}
