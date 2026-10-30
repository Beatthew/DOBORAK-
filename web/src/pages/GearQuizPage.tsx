import { useLocation } from 'react-router-dom';
import { GearQuiz } from '../components/GearQuiz';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';

/** A Gear kvíz az órából megnyitva: a diák nem látja a tananyag oldalait, ezért saját útvonala van. */
export function GearQuizPage() {
  const { pick, text } = useI18n();
  const { state } = useLocation() as { state?: { back?: string } };
  return (
    <>
      <TopBar title={text('Gear kvíz')} backTo={state?.back ?? '/'} backLabel={pick('Vissza', 'Back')}>
        <p className="top-sub">{text('A dobfelszerelés kilenc hangszere')}</p>
      </TopBar>
      <main className="page">
        <GearQuiz />
      </main>
    </>
  );
}
