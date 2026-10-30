import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

const INTERACTIVE = 'input, textarea, select, a, label, button:not(.grip)';
const HOLD_MS = 280;
const MOVE_PX = 6;
const EDGE_PX = 70;
const MAX_SCROLL = 14;
const SHIFT = { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Grab {
  key: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** A kártya bal felső sarka a mutatóhoz képest, oldal-koordinátában. */
  dx: number;
  dy: number;
  /** Oldal-koordináta = offsetLeft/Top + ez. */
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  /** Az utoljára félrelökött kártya: addig nem számít újra, amíg a mutató el nem hagyja. */
  passed: string | null;
  active: boolean;
  timer?: number;
}

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  onMove: (from: number, to: number) => void;
  /** A kártya tartalma; a `move` a billentyűzetes (fogantyús) mozgatáshoz kell. */
  children: (item: T, move: (delta: number) => void) => ReactNode;
}

/** Húzható rács-elemek, mint a telefon kezdőképernyője: a húzott kártya követi az ujjat, a többi kitér neki.
 *  Egérrel azonnal húzható, érintéssel rövid nyomva tartás után (különben az oldal görgetése lenne). */
export function Sortable<T>({ items, keyOf, onMove, children }: Props<T>) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const before = useRef(new Map<string, DOMRect>());
  const grab = useRef<Grab | null>(null);
  const latest = useRef({ items, keyOf, onMove });
  latest.current = { items, keyOf, onMove };
  const [dragging, setDragging] = useState<string | null>(null);

  const place = () => {
    const g = grab.current;
    const el = g && nodes.current.get(g.key);
    if (!g || !el) return;
    const left = g.x + window.scrollX - g.dx - g.baseX - el.offsetLeft;
    const top = g.y + window.scrollY - g.dy - g.baseY - el.offsetTop;
    el.style.transform = `translate(${left}px, ${top}px)`;
  };

  /** Ha a mutató egy másik kártya helyén jár, oda kerül a húzott kártya. */
  const hitTest = () => {
    const g = grab.current;
    if (!g) return;
    const { items: list, keyOf: key, onMove: move } = latest.current;
    const px = g.x + window.scrollX - g.baseX;
    const py = g.y + window.scrollY - g.baseY;
    const inside = (el: HTMLElement) =>
      px >= el.offsetLeft && px <= el.offsetLeft + el.offsetWidth && py >= el.offsetTop && py <= el.offsetTop + el.offsetHeight;
    const passed = g.passed ? nodes.current.get(g.passed) : null;
    if (passed && !inside(passed)) g.passed = null;
    const target = list.map(key).find((k) => k !== g.key && k !== g.passed && inside(nodes.current.get(k)!));
    if (!target) return;
    const keys = list.map(key);
    nodes.current.forEach((el, k) => before.current.set(k, el.getBoundingClientRect()));
    g.passed = target;
    move(keys.indexOf(g.key), keys.indexOf(target));
  };

  // A sorrend változásakor mindenki a régi helyéről siklik az újra (a húzott kártyát a place() viszi).
  useLayoutEffect(() => {
    if (!before.current.size) return;
    nodes.current.forEach((el, key) => {
      const old = before.current.get(key);
      if (!old) return;
      if (key === grab.current?.key) return place();
      el.getAnimations().forEach((a) => a.cancel());
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if ((dx || dy) && !calm()) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], SHIFT);
    });
    before.current.clear();
  });

  const lift = () => {
    const g = grab.current;
    if (!g) return;
    g.active = true;
    setDragging(g.key);
    if (navigator.vibrate) navigator.vibrate(10);
    place();
  };

  const finish = () => {
    const g = grab.current;
    if (!g) return;
    window.clearTimeout(g.timer);
    grab.current = null;
    setDragging(null);
    const el = nodes.current.get(g.key);
    if (!el || !g.active) return;
    const from = el.style.transform;
    el.style.transform = '';
    if (from && !calm()) el.animate([{ transform: from }, { transform: 'none' }], SHIFT);
  };

  // Húzás közben a mutató eseményei az egész ablakból jönnek, és az oldal nem görög az ujj alatt.
  useEffect(() => {
    const moved = (e: PointerEvent) => {
      const g = grab.current;
      if (!g || e.pointerId !== g.pointerId) return;
      g.x = e.clientX;
      g.y = e.clientY;
      if (!g.active) {
        const far = Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > MOVE_PX;
        if (!far) return;
        if (e.pointerType === 'mouse') lift();
        else return finish(); // az ujj a tartás letelte előtt elindult: ez görgetés
      }
      place();
      hitTest();
    };
    const stopTouch = (e: TouchEvent) => {
      if (grab.current?.active) e.preventDefault();
    };
    const stopMenu = (e: Event) => {
      if (grab.current) e.preventDefault();
    };
    window.addEventListener('pointermove', moved);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('touchmove', stopTouch, { passive: false });
    window.addEventListener('contextmenu', stopMenu);
    return () => {
      window.removeEventListener('pointermove', moved);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('touchmove', stopTouch);
      window.removeEventListener('contextmenu', stopMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A képernyő széléhez húzva az oldal görög tovább.
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const g = grab.current;
      if (g) {
        const top = EDGE_PX - g.y;
        const bottom = g.y - (window.innerHeight - EDGE_PX);
        const speed = top > 0 ? -top : bottom > 0 ? bottom : 0;
        if (speed) {
          window.scrollBy(0, Math.max(-MAX_SCROLL, Math.min(MAX_SCROLL, speed / 4)));
          place();
          hitTest();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const start = (key: string, e: ReactPointerEvent<HTMLDivElement>) => {
    if (grab.current || e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) return;
    const el = e.currentTarget;
    el.getAnimations().forEach((a) => a.cancel());
    const box = el.getBoundingClientRect();
    const g: Grab = {
      key,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: e.clientX - box.left,
      dy: e.clientY - box.top,
      baseX: box.left + window.scrollX - el.offsetLeft,
      baseY: box.top + window.scrollY - el.offsetTop,
      x: e.clientX,
      y: e.clientY,
      passed: null,
      active: false,
    };
    if (e.pointerType !== 'mouse') g.timer = window.setTimeout(lift, HOLD_MS);
    grab.current = g;
  };

  const keyboardMove = (key: string, delta: number) => {
    const keys = items.map(keyOf);
    const from = keys.indexOf(key);
    const to = from + delta;
    if (to < 0 || to >= keys.length) return;
    nodes.current.forEach((el, k) => before.current.set(k, el.getBoundingClientRect()));
    onMove(from, to);
  };

  return (
    <>
      {items.map((item) => {
        const key = keyOf(item);
        return (
          <div
            key={key}
            className={`sortable-item${dragging === key ? ' dragging' : ''}`}
            ref={(el) => {
              if (el) nodes.current.set(key, el);
              else nodes.current.delete(key);
            }}
            onPointerDown={(e) => start(key, e)}
          >
            {children(item, (delta) => keyboardMove(key, delta))}
          </div>
        );
      })}
    </>
  );
}
