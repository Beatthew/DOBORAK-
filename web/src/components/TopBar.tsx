import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { BackIcon } from './Icons';
import { LangSwitch } from './LangSwitch';

interface Props {
  title: string;
  /** Where the back link goes; without it the bar shows the app name. */
  backTo?: string;
  backLabel?: string;
  children?: ReactNode;
}

export function TopBar({ title, backTo, backLabel, children }: Props) {
  const { t } = useI18n();
  return (
    <header className="top on-dark">
      <div className="top-bar">
        {backTo ? (
          <Link className="top-link" to={backTo}>
            <BackIcon />
            {backLabel ?? t.back}
          </Link>
        ) : (
          <span className="top-name">{t.appName}</span>
        )}
        <LangSwitch />
      </div>
      <h1 className="display">{title}</h1>
      {children}
    </header>
  );
}
