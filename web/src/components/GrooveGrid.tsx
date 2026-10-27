import { Fragment } from 'react';
import { useI18n } from '../i18n';
import type { Groove } from '../types';

const rows = ['hh', 'sn', 'kk'] as const;

export function GrooveGrid({ groove }: { groove: Groove }) {
  const { t } = useI18n();
  return (
    <div className="grid-wrap">
      <div className="groove-grid">
        {rows.map((row) => (
          <Fragment key={row}>
            <div className="grid-label">{t[row]}</div>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`grid-cell${i % 2 === 0 ? ' beat' : ''}`}>
                {groove[row][i] === '1' &&
                  (row === 'hh' ? <span className="mark-x">×</span> : <span className="mark-dot" />)}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="grid-count" aria-hidden="true">
        <span />
        {t.count.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    </div>
  );
}
