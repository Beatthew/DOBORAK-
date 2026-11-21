/* iPhone / iPad: a Web Audio hang alapból „csengőhang” jellegű, ezért a telefon néma kapcsolójával elnémul
   (és a Facebook / Messenger beépített böngészőjében is). Lejátszáskor ezért:
   1. az audioSession „playback” módba kerül (ahol a böngésző ismeri),
   2. mellette szól egy néma, ismétlődő <audio> elem — ettől az iOS zenelejátszásként kezeli az oldalt,
      és a néma kapcsoló ellenére is hallani a dalt. Más eszközökön ez nem változtat semmin. */

let el: HTMLAudioElement | null = null;
let url = '';

/** fél másodperc csend, 8 kHz-es mono 8 bites WAV-ként */
function silentWav() {
  const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** lejátszás indításakor (felhasználói koppintásból) on=true, megállításkor on=false */
export function iosPlayback(on: boolean) {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s && on && s.type !== 'playback') s.type = 'playback';
  } catch {
    /* nem támogatott */
  }
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) return;
  if (on) {
    if (!el) {
      url ||= silentWav();
      el = new Audio(url);
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('x-webkit-airplay', 'deny');
    }
    void el.play().catch(() => undefined);
  } else {
    el?.pause();
  }
}
