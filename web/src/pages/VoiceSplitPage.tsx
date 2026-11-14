import { useLocation } from 'react-router-dom';
import { VoiceSplit } from '../components/VoiceSplit';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';

/** A szólambontás kiadott anyagként megnyitva: a diák nem látja a tananyag oldalait, ezért saját útvonala van. */
export function VoiceSplitPage() {
  const { pick } = useI18n();
  const { state } = useLocation() as { state?: { back?: string } };
  return (
    <>
      <TopBar title={pick('Elég Ha Élsz – szólambontás', 'Elég Ha Élsz – voice split')} backTo={state?.back ?? '/'} backLabel={pick('Vissza', 'Back')}>
        <p className="top-sub">{pick('A groove szólamonként és párosával', 'The groove voice by voice and in pairs')}</p>
      </TopBar>
      <main className="page">
        <VoiceSplit />
      </main>
    </>
  );
}
