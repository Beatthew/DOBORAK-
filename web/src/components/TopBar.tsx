import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BackIcon } from './Icons';
import { LangSwitch } from './LangSwitch';

/** A név: BEAT világos, HUB menta. */
export const Brand = () => (
  <span className="brand">
    BEAT<b>HUB</b>
  </span>
);

interface Props {
  title: ReactNode;
  /** Where the back link goes; without it the bar shows the app name. */
  backTo?: string;
  backLabel?: string;
  /** A kezdőlapon a cím maga a név: fent nem kell még egyszer. */
  hideName?: boolean;
  children?: ReactNode;
}

export function TopBar({ title, backTo, backLabel, hideName, children }: Props) {
  return (
    <header className="top on-dark">
      <div className="top-bar">
        {backTo ? (
          <Link className="top-link" to={backTo}>
            <BackIcon />
            {backLabel ?? 'Vissza'}
          </Link>
        ) : (
          <span className="top-name">{!hideName && <Brand />}</span>
        )}
        <LangSwitch />
      </div>
      <h1 className="display">{title}</h1>
      {children}
    </header>
  );
}
