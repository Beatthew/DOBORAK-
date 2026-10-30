/* A Gear kvíz: a dobfelszerelés kilenc fő hangszere, mindegyikhez a kameraállás, ahová a teljes szett képéről ráközelít. */

export const GEAR_REF = 'hangszerismeret/gear-kviz';
/** A kiadott anyag oldala (a diák is eléri). */
export const GEAR_PATH = '/anyag/gear-kviz';

export type GearId = 'snare' | 'kick' | 'hihat' | 'high' | 'mid' | 'floor' | 'ride' | 'crash' | 'splash';

/** A kép középpontja és szélessége a rajz koordinátáiban; a magasság a kép 4:3 arányából jön. */
export interface GearCamera {
  cx: number;
  cy: number;
  w: number;
}

export interface GearPiece {
  id: GearId;
  nameHu: string;
  nameEn: string;
  camera: GearCamera;
}

export const KIT_CAMERA: GearCamera = { cx: 545, cy: 385, w: 1040 };

export const GEAR_PIECES: GearPiece[] = [
  { id: 'snare', nameHu: 'Pergő', nameEn: 'Snare drum', camera: { cx: 400, cy: 465, w: 310 } },
  { id: 'kick', nameHu: 'Lábdob', nameEn: 'Bass drum', camera: { cx: 590, cy: 510, w: 500 } },
  { id: 'hihat', nameHu: 'Lábcin', nameEn: 'Hi-hat', camera: { cx: 190, cy: 350, w: 270 } },
  { id: 'high', nameHu: 'Felső tam', nameEn: 'High tom', camera: { cx: 478, cy: 250, w: 280 } },
  { id: 'mid', nameHu: 'Középső tam', nameEn: 'Mid tom', camera: { cx: 692, cy: 255, w: 300 } },
  { id: 'floor', nameHu: 'Alsó tam', nameEn: 'Floor tom', camera: { cx: 830, cy: 525, w: 440 } },
  { id: 'ride', nameHu: 'Ride', nameEn: 'Ride cymbal', camera: { cx: 880, cy: 130, w: 340 } },
  { id: 'crash', nameHu: 'Crash', nameEn: 'Crash cymbal', camera: { cx: 270, cy: 112, w: 320 } },
  { id: 'splash', nameHu: 'Splash', nameEn: 'Splash cymbal', camera: { cx: 585, cy: 112, w: 180 } },
];

const RATIO = 3 / 4;

/** A kameraállás mint SVG viewBox: [x, y, szélesség, magasság]. */
export function cameraBox({ cx, cy, w }: GearCamera): [number, number, number, number] {
  const h = w * RATIO;
  return [cx - w / 2, cy - h / 2, w, h];
}
