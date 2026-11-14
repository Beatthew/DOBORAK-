import { useLocation } from 'react-router-dom';
import { RhythmScale } from '../components/RhythmScale';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';

/** A ritmusskála kiadott anyagként megnyitva: a diák nem látja a tananyag oldalait, ezért saját útvonala van. */
export function RhythmScalePage() {
  const { pick } = useI18n();
  const { state } = useLocation() as { state?: { back?: string } };
  return (
    <>
      <TopBar title={pick('Ritmusskála', 'Rhythm scale')} backTo={state?.back ?? '/'} backLabel={pick('Vissza', 'Back')}>
        <p className="top-sub">{pick('Negyedek, nyolcadok, tizenhatodok váltott kézzel', 'Quarters, eighths, sixteenths with alternating hands')}</p>
      </TopBar>
      <main className="page">
        <RhythmScale />
      </main>
    </>
  );
}
