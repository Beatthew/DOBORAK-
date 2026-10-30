import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cameraBox, GEAR_PIECES, KIT_CAMERA, type GearCamera, type GearId } from '../data/gear';
import { useI18n } from '../i18n';

/* A szett a dobos felől, kissé felülről nézve: balra a lábcin és a pergő, jobbra az alsó tam és a ride, középen a lábdob a pedállal.
   Minden test tömör (a háttér színével), így a hátrébb lévő vonalakat takarja. */

interface DrumProps {
  x: number;
  y: number;
  rx: number;
  h: number;
  tilt?: number;
  lugs?: number;
  skew?: number;
}

function Drum({ x, y, rx, h, tilt = 0, lugs = 4, skew = 0.34 }: DrumProps) {
  const ry = rx * skew;
  const arc = (top: number) => `M${x - rx} ${top}A${rx} ${ry} 0 0 0 ${x + rx} ${top}`;
  // alacsony testen egy sor középen, magasabbon egy-egy sor a két karima alatt
  const rows = h < 70 ? [[0.3, 0.4]] : [[0.13, 0.24], [0.63, 0.24]];
  const hardware = Array.from({ length: lugs }, (_, i) => {
    const angle = (Math.PI * (i + 0.5)) / lugs;
    const lx = x + rx * Math.cos(angle);
    const ly = y + ry * Math.sin(angle);
    return rows.map(([at, size]) => <rect key={`${i}-${at}`} className="fine" x={lx - 3.5} y={ly + h * at} width={7} height={h * size} rx={3.5} />);
  });
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y + h / 2})` : undefined}>
      <path d={`M${x - rx} ${y}V${y + h}A${rx} ${ry} 0 0 0 ${x + rx} ${y + h}V${y}Z`} />
      <path className="open fine" d={arc(y + 7)} />
      <path className="open fine" d={arc(y + h - 7)} />
      {hardware}
      <ellipse cx={x} cy={y} rx={rx} ry={ry} />
      <ellipse className="open fine" cx={x} cy={y} rx={rx - 7} ry={ry - 3.5} />
    </g>
  );
}

function Cymbal({ x, y, rx, tilt = 0, skew = 0.3 }: { x: number; y: number; rx: number; tilt?: number; skew?: number }) {
  const ry = rx * skew;
  const bell = rx * 0.2;
  const dome = bell * 0.75;
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} />
      <ellipse className="open fine" cx={x} cy={y} rx={rx * 0.74} ry={ry * 0.74} />
      <ellipse className="open fine" cx={x} cy={y} rx={rx * 0.47} ry={ry * 0.47} />
      <path d={`M${x - bell} ${y}Q${x - bell * 0.7} ${y - dome} ${x} ${y - dome}Q${x + bell * 0.7} ${y - dome} ${x + bell} ${y}A${bell} ${bell * skew} 0 0 1 ${x - bell} ${y}Z`} />
      <line x1={x} x2={x} y1={y - dome} y2={y - dome - 10} />
    </g>
  );
}

/** Háromlábú állvány gumitalpakkal és bilinccsel, a rúd aljától a talajig. */
function Tripod({ x, floor = 700, spread = 40 }: { x: number; floor?: number; spread?: number }) {
  const top = floor - 66;
  return (
    <>
      <path
        className="open"
        d={`M${x} ${top}L${x - spread} ${floor}M${x} ${top}L${x + spread} ${floor}M${x} ${top}V${floor + 8}M${x} ${floor - 26}L${x - spread * 0.62} ${floor - 25}M${x} ${floor - 26}L${x + spread * 0.62} ${floor - 25}`}
      />
      <rect x={x - 6} y={top - 5} width={12} height={10} rx={2} />
      <path className="open" strokeWidth="3" d={`M${x - spread - 6} ${floor}H${x - spread + 6}M${x + spread - 6} ${floor}H${x + spread + 6}`} />
    </>
  );
}

const PARTS: { id: GearId; art: ReactNode }[] = [
  {
    id: 'ride',
    art: (
      <>
        <path className="open" d="M880 130L985 634" />
        <Tripod x={985} />
        <Cymbal x={880} y={130} rx={135} tilt={10} />
      </>
    ),
  },
  {
    id: 'crash',
    art: (
      <>
        <path className="open" d="M270 110L300 634" />
        <Tripod x={300} spread={36} />
        <Cymbal x={270} y={110} rx={122} tilt={-10} />
      </>
    ),
  },
  {
    id: 'splash',
    art: (
      <>
        <path className="open" d="M585 112V300" />
        <Cymbal x={585} y={112} rx={60} />
      </>
    ),
  },
  { id: 'high', art: <Drum x={478} y={205} rx={90} h={88} tilt={-3} /> },
  { id: 'mid', art: <Drum x={692} y={205} rx={98} h={96} tilt={3} /> },
  {
    id: 'kick',
    art: (
      <>
        <path d="M440 500L448 478A142 142 0 0 1 732 478L740 500Z" />
        <circle cx={590} cy={500} r={150} />
        <circle className="open" cx={590} cy={500} r={138} />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI * 2 * (i + 0.5)) / 10;
          return <line key={i} className="fine" x1={590 + 138 * Math.cos(a)} y1={500 + 138 * Math.sin(a)} x2={590 + 150 * Math.cos(a)} y2={500 + 150 * Math.sin(a)} />;
        })}
        <path className="open" d="M590 630V530" />
        <circle cx={590} cy={518} r={13} />
        <path d="M574 630H606L602 650H578Z" />
        <path d="M568 712H612L602 650H578Z" />
      </>
    ),
  },
  {
    id: 'floor',
    art: (
      <>
        <path className="open" d="M735 510L712 694M925 510L948 694M830 560V712" />
        <path className="open" strokeWidth="3" d="M704 694H720M940 694H956M822 712H838" />
        <Drum x={830} y={395} rx={112} h={170} lugs={5} skew={0.3} />
      </>
    ),
  },
  {
    id: 'snare',
    art: (
      <>
        <path className="open" d="M400 500V634M400 510L340 470M400 510L460 470" />
        <Tripod x={400} />
        <Drum x={400} y={425} rx={96} h={52} lugs={6} skew={0.32} />
        <rect x={388} y={462} width={24} height={12} rx={2} />
      </>
    ),
  },
  {
    id: 'hihat',
    art: (
      <>
        <path className="open" d="M190 292V634" />
        <Tripod x={190} spread={44} />
        <path d="M172 720H208L199 668H181Z" />
        <Cymbal x={190} y={352} rx={88} skew={0.2} />
        <Cymbal x={190} y={338} rx={88} skew={0.2} />
      </>
    ),
  },
];

interface ArtProps {
  /** A kiemelt hangszer; nélküle a teljes szett egyforma vonallal. */
  active?: GearId;
  lit?: boolean;
  camera?: GearCamera;
  svgRef?: Ref<SVGSVGElement>;
}

export function KitArt({ active, lit = false, camera = KIT_CAMERA, svgRef }: ArtProps) {
  return (
    <svg ref={svgRef} className={`gear-art${lit ? ' lit' : ''}`} viewBox={cameraBox(camera).join(' ')} aria-hidden="true">
      <path className="gear-part" d="M578 350V285M592 350V285M578 300L500 270M592 300L670 270" fill="none" />
      {PARTS.map((p) => (
        <g key={p.id} className={`gear-part${p.id === active ? ' on' : ''}`}>
          {p.art}
        </g>
      ))}
    </svg>
  );
}

const HOLD_MS = 650;
const LIGHT_MS = 500;
const ZOOM_MS = 1200;
const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

/** Egy kártya: a teljes szettről indul, kiemeli a hangszert, aztán ráközelít; koppintásra megfordul. */
function GearCard({ index, replay }: { index: number; replay: number }) {
  const { pick } = useI18n();
  const piece = GEAR_PIECES[index];
  const [flipped, setFlipped] = useState(false);
  const [lit, setLit] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const art = useRef<SVGSVGElement>(null);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    const svg = art.current;
    if (!svg) return;
    setFlipped(false);
    const from = cameraBox(KIT_CAMERA);
    const to = cameraBox(piece.camera);
    const put = (box: number[]) => svg.setAttribute('viewBox', box.join(' '));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      put(to);
      setLit(true);
      setZoomed(true);
      return;
    }
    put(from);
    setLit(false);
    setZoomed(false);
    const light = window.setTimeout(() => setLit(true), HOLD_MS);
    const start = performance.now() + HOLD_MS + LIGHT_MS;
    let raf = 0;
    const frame = (now: number) => {
      const x = Math.min(1, Math.max(0, (now - start) / ZOOM_MS));
      put(from.map((v, i) => v + (to[i] - v) * ease(x)));
      if (x < 1) raf = requestAnimationFrame(frame);
      else setZoomed(true);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      window.clearTimeout(light);
      cancelAnimationFrame(raf);
    };
  }, [piece, replay]);

  const name = pick(piece.nameHu, piece.nameEn);
  const other = pick(piece.nameEn, piece.nameHu);

  return (
    <button
      type="button"
      className={`gear-card${flipped ? ' flipped' : ''}`}
      aria-label={flipped ? `${name} (${other})` : pick('Melyik hangszer ez? Koppints a válaszért.', 'Which instrument is this? Tap for the answer.')}
      onPointerDown={(e) => { swipe.current = e.clientX; }}
      onClick={(e) => {
        // a lapozó húzás nem fordít: azt a szülő kezeli
        if (swipe.current !== null && Math.abs(e.clientX - swipe.current) > 40) return;
        setFlipped((f) => !f);
      }}
    >
      <span className="gear-flip">
        <span className="gear-face front tone-1">
          <KitArt active={piece.id} lit={lit} svgRef={art} />
          <span className={`gear-prompt${zoomed ? ' on' : ''}`}>{pick('Melyik hangszer ez?', 'Which instrument is this?')}</span>
        </span>
        <span className="gear-face back tone-0">
          <KitArt active={piece.id} lit camera={piece.camera} />
          <span className="gear-name">{name}</span>
          <span className="gear-other">{other}</span>
        </span>
      </span>
    </button>
  );
}

/** A Gear kvíz: flip cardok a felszerelés hangszereivel, gombbal, húzással és nyilakkal lapozva. */
export function GearQuiz() {
  const { pick } = useI18n();
  const [index, setIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const start = useRef<number | null>(null);
  const count = GEAR_PIECES.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  return (
    <div className="gear-quiz">
      <div className="gear-head">
        <b>
          {index + 1} / {count}
        </b>
        <button type="button" className="btn ghost small" onClick={() => setReplay((r) => r + 1)}>
          {pick('Animáció újra', 'Replay animation')}
        </button>
      </div>
      <div
        className="gear-stage"
        onPointerDown={(e) => { start.current = e.clientX; }}
        onPointerUp={(e) => {
          if (start.current === null) return;
          const dx = e.clientX - start.current;
          start.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <GearCard key={GEAR_PIECES[index].id} index={index} replay={replay} />
      </div>
      <div className="gear-nav">
        <button type="button" className="btn ghost" onClick={() => go(-1)}>
          {pick('Előző', 'Previous')}
        </button>
        <button type="button" className="btn primary" onClick={() => go(1)}>
          {pick('Következő', 'Next')}
        </button>
      </div>
    </div>
  );
}
