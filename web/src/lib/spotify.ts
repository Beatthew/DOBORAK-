/** Returns the link only when it really points at open.spotify.com over https; anything else is dropped. */
export function spotifyHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'open.spotify.com') return url.toString();
  } catch {
    // not a URL
  }
  return null;
}
