import { useI18n } from '../i18n';
import type { Lang } from '../types';

const langs: { code: Lang; label: string; name: string }[] = [
  { code: 'hu', label: 'HU', name: 'Magyar' },
  { code: 'en', label: 'EN', name: 'English' },
];

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t.language}>
      {langs.map((l) => (
        <button
          key={l.code}
          type="button"
          aria-pressed={lang === l.code}
          aria-label={l.name}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
