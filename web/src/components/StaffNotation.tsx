import { useI18n } from '../i18n';
import type { Drum, Fill } from '../types';

// Drum staff positions (y of the notehead centre); the top line sits at y = 40, lines are 10 apart.
const noteY: Record<Drum, number> = { t1: 45, t2: 50, sn: 55, ft: 65 };
const CRASH_Y = 30;
const KICK_Y = 75;
const noteX = (i: number) => 72 + 34 * i;
const LANDING_X = 362;

const Head = ({ x, y }: { x: number; y: number }) => (
  <ellipse cx={x} cy={y} rx="6.5" ry="4.8" transform={`rotate(-20 ${x} ${y})`} fill="currentColor" />
);

const Staff = ({ width }: { width: number }) => (
  <path
    d={[40, 50, 60, 70, 80].map((y) => `M0 ${y}H${width}`).join('')}
    stroke="currentColor"
    strokeWidth="1.2"
  />
);

/** One bar of a fill in drum notation, plus the crash + kick it lands on, with count and sticking underneath. */
export function StaffNotation({ fill, label }: { fill: Fill; label: string }) {
  const { t } = useI18n();
  return (
    <svg className="staff" viewBox="0 0 404 152" role="img" aria-label={label}>
      <Staff width={404} />
      <rect x="10" y="50" width="4" height="20" fill="currentColor" />
      <rect x="18" y="50" width="4" height="20" fill="currentColor" />
      <g fill="currentColor" fontSize="22" fontWeight="900" textAnchor="middle">
        <text x="42" y="59">4</text>
        <text x="42" y="79">4</text>
      </g>

      {fill.drums.map((d, i) => (
        <Head key={i} x={noteX(i)} y={noteY[d]} />
      ))}
      <path
        d={fill.drums.map((d, i) => `M${noteX(i) + 6} ${noteY[d] - 1}V10`).join('')}
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} x={noteX(i) + 5.2} y="8" width="35.6" height="5" fill="currentColor" />
      ))}

      <path d="M334 40V80M391 40V80" stroke="currentColor" strokeWidth="1.5" />
      <path d="M398 40V80" stroke="currentColor" strokeWidth="5" />
      <path d={`M${LANDING_X - 12} ${CRASH_Y}H${LANDING_X + 12}`} stroke="currentColor" strokeWidth="1.2" />
      <path
        d={`M${LANDING_X - 6} ${CRASH_Y - 6}l12 12M${LANDING_X + 6} ${CRASH_Y - 6}l-12 12`}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d={`M${LANDING_X + 7} ${CRASH_Y - 1}V2`} stroke="currentColor" strokeWidth="1.6" />
      <Head x={LANDING_X} y={KICK_Y} />
      <path d={`M${LANDING_X - 6.5} ${KICK_Y + 1}V106`} stroke="currentColor" strokeWidth="1.6" />

      <g fill="currentColor" fontSize="14" fontWeight="600" textAnchor="middle">
        {t.count.map((c, i) => (
          <text key={i} x={noteX(i)} y="124">
            {c}
          </text>
        ))}
        <text x={LANDING_X} y="124">
          {t.count[0]}
        </text>
      </g>
      <g fill="currentColor" fontSize="20" fontWeight="900" textAnchor="middle">
        {t.sticking.map((s, i) => (
          <text key={i} x={noteX(i)} y="146">
            {s}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** Which line or space belongs to which drum. */
export function StaffKey() {
  const { t } = useI18n();
  const items: { label: string; y: number; cross?: boolean }[] = [
    { label: t.crash, y: CRASH_Y - 15, cross: true },
    { label: t.t1, y: noteY.t1 - 15 },
    { label: t.t2, y: noteY.t2 - 15 },
    { label: t.sn, y: noteY.sn - 15 },
    { label: t.ft, y: noteY.ft - 15 },
    { label: t.kk, y: KICK_Y - 15 },
  ];
  return (
    <svg className="staff-key" viewBox="0 0 390 108" role="img" aria-label={t.staffKey}>
      <path d={[25, 35, 45, 55, 65].map((y) => `M0 ${y}H390`).join('')} stroke="currentColor" strokeWidth="1.2" />
      {items.map((item, i) => {
        const x = 33 + 64 * i;
        return (
          <g key={item.label}>
            {item.cross ? (
              <>
                <path d={`M${x - 12} 15H${x + 12}`} stroke="currentColor" strokeWidth="1.2" />
                <path
                  d={`M${x - 6} 9l12 12M${x + 6} 9l-12 12`}
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <Head x={x} y={item.y} />
            )}
            <text x={x} y="92" fill="currentColor" fontSize="12" fontWeight="700" textAnchor="middle">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
