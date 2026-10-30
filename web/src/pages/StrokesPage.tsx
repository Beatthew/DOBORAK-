import { useLocation } from 'react-router-dom';
import { StrokesLesson } from '../components/Strokes';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n';

/** A Strokes anyag az órából megnyitva: a diák nem látja a tananyag oldalait, ezért saját útvonala van. */
export function StrokesPage() {
  const { pick, text } = useI18n();
  const { state } = useLocation() as { state?: { back?: string } };
  return (
    <>
      <TopBar title="Strokes" backTo={state?.back ?? '/'} backLabel={pick('Vissza', 'Back')}>
        <p className="top-sub">{text('A négy ütéstípus és 27 gyakorlat')}</p>
      </TopBar>
      <main className="page">
        <StrokesLesson />
      </main>
    </>
  );
}
