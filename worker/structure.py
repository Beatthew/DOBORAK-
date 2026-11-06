"""Song structure for Song Practice: bars (downbeats), BPM, OFFSET, TEMPO_MAP and SECTIONS.

1. Beats + downbeat candidates: beat_this (CPJKU, 2024) on the full mix (drums + band).
2. Bars: a 4/4 Viterbi pass over the beats. beat_this alone sometimes "hears" half bars on slow
   swing songs; forcing 4 beats per bar (with a costly escape for real 2/3-beat bars) fixes that.
3. Sections: bar-synchronous features (harmony, timbre, loudness, drum activity), novelty on a
   self-similarity matrix, boundaries snapped to 2-bar grid, segments clustered into repeats and
   named with simple heuristics (Intro / Verse / Pre-chorus / Chorus / Bridge / Outro / Vége).
   Names are a starting point; they are meant to be checked and edited.
"""
import json
import re

import librosa
import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import find_peaks

SR = 44100
DEBUG = False
_a2b = None


def beat_model(device):
    global _a2b
    if _a2b is None:
        from beat_this.inference import Audio2Beats
        _a2b = Audio2Beats(device=device)
    return _a2b


# ---------------------------------------------------------------- bars

def assign_bars(beats, downs, tol=0.07):
    """Viterbi over beats: state = position in bar (0..3). Returns indices of bar-start beats."""
    n = len(beats)
    is_down = np.array([np.min(np.abs(downs - b)) < tol if len(downs) else False for b in beats])
    # emission: a bar start on a detected downbeat is rewarded, elsewhere penalised
    emit = np.zeros((n, 4))
    emit[:, 0] = np.where(is_down, 2.0, -1.0)
    emit[:, 1:] = np.where(is_down, -0.6, 0.0)[:, None]
    SKIP = -6.0  # starting a new bar early (2- or 3-beat bar) is allowed but expensive
    score = emit[0].copy()
    back = np.zeros((n, 4), dtype=int)
    for i in range(1, n):
        new = np.full(4, -np.inf)
        for s in range(4):
            prev = (s - 1) % 4
            cand = [(score[prev], prev)]
            if s == 0:
                cand += [(score[p] + SKIP, p) for p in (1, 2)]
            best = max(cand)
            new[s], back[i, s] = best[0] + emit[i, s], best[1]
        score = new
    states = np.zeros(n, dtype=int)
    states[-1] = int(np.argmax(score))
    for i in range(n - 1, 0, -1):
        states[i - 1] = back[i, states[i]]
    return np.flatnonzero(states == 0)


def bar_length(downbeats):
    """The song's real bar length: the one most bars agree on (within ±3%), not the median.
    On syncopated grooves the tracker sometimes takes half or three-quarter bars for whole ones;
    enough of those pull the median off (e.g. 114 BPM read as 130)."""
    dur = np.diff(np.asarray(downbeats, float))
    if not len(dur):
        return 2.0
    agree = [np.sum(np.abs(dur - x) <= 0.03 * x) for x in dur]
    x = dur[int(np.argmax(agree))]
    return float(np.median(dur[np.abs(dur - x) <= 0.03 * x]))


def irregular_bars(downbeats, tol=0.08):
    """Bars whose length is more than `tol` off the song's bar length — where the click would race or drag."""
    d = np.asarray(downbeats, float)
    if len(d) < 3:
        return []
    L = bar_length(d)
    return [i + 1 for i, x in enumerate(np.diff(d)) if abs(x - L) > tol * L]


def regrid(downbeats, tol=0.06):
    """A steady bar grid over the detected downbeats (TEMPÓ ÚJRA in the editor).

    From the longest run of regular bars it steps one bar length at a time, forwards and backwards.
    Where a detected downbeat lies within `tol` of the expected place the grid snaps to it, and the
    bar length follows it slowly (live, drifting songs stay in time); detections in between — half or
    three-quarter bars from a confused tracker — are skipped. Returns (bar start times, bar length)."""
    d = np.asarray(downbeats, float)
    L0 = bar_length(d)
    ok = np.abs(np.diff(d) - L0) <= tol * L0
    best, start, i = 0, 0, 0
    while i < len(ok):                          # anchor: the first bar of the longest regular run
        if not ok[i]:
            i += 1
            continue
        j = i
        while j < len(ok) and ok[j]:
            j += 1
        if j - i > best:
            best, start = j - i, i
        i = j

    def walk(t, sign, limit):
        out, L = [], L0
        while True:
            p = t + sign * L
            if (p > limit) if sign > 0 else (p < limit):
                return out
            near = d[np.abs(d - p) <= tol * L0]
            if len(near):
                q = float(near[np.argmin(np.abs(near - p))])
                L = min(max(0.8 * L + 0.2 * abs(q - t), 0.9 * L0), 1.1 * L0)
                p = q
            out.append(p)
            t = p

    a = float(d[start])
    grid = walk(a, -1, d[0] - 0.5 * L0)[::-1] + [a] + walk(a, 1, d[-1] + 0.5 * L0)
    return np.round(np.array(grid), 2), L0


def remap_sections(sections, old_db, new_db):
    """Carry sections and the bars' notation over to a new bar grid, by time: every section starts at the
    new bar nearest to its old first bar, and every new bar takes the notation of the old bar nearest to it."""
    old_db, new_db = np.asarray(old_db, float), np.asarray(new_db, float)
    n_old, n_new = len(old_db), len(new_db)
    secs = sorted(sections, key=lambda x: x["from"])
    refs = [None] * max(n_old, secs[-1]["to"] if secs else 0)
    for s in secs:
        for j, r in enumerate(s.get("bars") or []):
            if s["from"] - 1 + j < len(refs) and j <= s["to"] - s["from"]:
                refs[s["from"] - 1 + j] = r
    near_new = lambda t: int(np.argmin(np.abs(new_db - t)))
    near_old = lambda t: int(np.argmin(np.abs(old_db - t)))
    out = []
    for s in secs:
        t = old_db[min(s["from"], n_old) - 1]
        f = near_new(t) + 1
        if out and f <= out[-1]["from"]:            # two old sections landed on the same bar: the later one moves on
            f = out[-1]["from"] + 1
        if f > n_new:
            break
        out.append({**s, "from": f})
    for i, s in enumerate(out):
        s["to"] = out[i + 1]["from"] - 1 if i + 1 < len(out) else n_new
        s["bars"] = [refs[near_old(new_db[k])] if near_old(new_db[k]) < len(refs) else None
                     for k in range(s["from"] - 1, s["to"])]
    return out


def apply_regrid(s):
    """TEMPÓ ÚJRA on a stored structure: new bars, BPM, tempo map; sections and notation carried over."""
    grid, L = regrid(s["downbeats"])
    old = s["downbeats"]
    s["sections"] = remap_sections(s["sections"], old, grid)
    s["downbeats"] = [float(t) for t in grid]
    s["bars"] = len(grid)
    s["offset"] = s["downbeats"][0]
    s["bpm"] = int(round(240 / L))
    s["tempo_map"] = compress_map(grid)
    return s


def compress_map(bar_times, tol=0.025):
    """[(bar, sec)] keeping only points needed for linear interpolation within `tol` seconds."""
    pts = [0]
    i = 0
    while i < len(bar_times) - 1:
        j = i + 2
        while j < len(bar_times):
            seg = np.arange(i, j + 1)
            lin = np.interp(seg, [i, j], [bar_times[i], bar_times[j]])
            if np.max(np.abs(lin - bar_times[seg])) > tol:
                break
            j += 1
        pts.append(j - 1)
        i = j - 1
    return [[k + 1, round(float(bar_times[k]), 2)] for k in pts]


# ---------------------------------------------------------------- sections

def bar_features(mix, drums, bar_times, sr=SR):
    mono = librosa.to_mono(mix)
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=mono, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=mono, sr=sr, n_mfcc=13, hop_length=hop)
    rms = librosa.feature.rms(y=mono, hop_length=hop)[0]
    drms = librosa.feature.rms(y=librosa.to_mono(drums), hop_length=hop)[0]
    frames = librosa.time_to_frames(bar_times, sr=sr, hop_length=hop)
    frames = np.clip(frames, 0, chroma.shape[1] - 1)

    def per_bar(x):
        x = np.atleast_2d(x)
        return np.stack([x[:, a:max(b, a + 1)].mean(1) for a, b in zip(frames[:-1], frames[1:])])

    return per_bar(chroma), per_bar(mfcc[1:]), per_bar(rms)[:, 0], per_bar(drms)[:, 0]


def zscore(x):
    return (x - x.mean(0)) / (x.std(0) + 1e-8)


def checkerboard_novelty(ssm, k=4):
    n = len(ssm)
    sign = np.sign(np.arange(-k, k) + 0.5)
    kernel = np.outer(sign, sign) * np.exp(-0.5 * (np.arange(-k, k) / k) ** 2)[:, None] \
        * np.exp(-0.5 * (np.arange(-k, k) / k) ** 2)[None, :]
    pad = np.pad(ssm, k, mode="edge")
    return np.array([np.sum(pad[i:i + 2 * k, i:i + 2 * k] * kernel) for i in range(n)])


def find_sections(chroma, timbre, loud, drum_rms):
    nb = len(loud)
    drum_on = drum_rms > 0.12 * np.percentile(drum_rms, 90)
    drum_on = median_filter(drum_on.astype(int), size=3).astype(bool)

    feat = np.hstack([zscore(chroma) * 1.0, zscore(timbre) * 0.8,
                      zscore(loud[:, None]) * 1.5, zscore(drum_rms[:, None]) * 1.5])
    unit = feat / (np.linalg.norm(feat, axis=1, keepdims=True) + 1e-8)
    ssm = unit @ unit.T
    nov = checkerboard_novelty(ssm, k=4)
    nov = (nov - nov.min()) / (np.ptp(nov) + 1e-8)

    # candidates: novelty peaks + every drum on/off change; snap to the 2-bar grid
    peaks, _ = find_peaks(nov, distance=4, prominence=0.08)
    changes = {int(c) for c in np.flatnonzero(np.diff(drum_on.astype(int))) + 1}  # plain ints: JSON-safe
    bounds = {0}
    for p in sorted({int(p) for p in peaks} | changes):
        q = p if p in changes else int(round(p / 2) * 2)
        if 0 < q < nb:
            bounds.add(q)
    bounds = sorted(bounds)
    # drop boundaries that would leave a section shorter than 4 bars (2 for drum on/off changes)
    merged = [bounds[0]]
    for b in bounds[1:]:
        if b - merged[-1] < (2 if b in changes else 4) or nb - b < 2:
            continue
        merged.append(b)
    starts = merged
    ends = starts[1:] + [nb]
    segs = [(a, b) for a, b in zip(starts, ends)]

    # cluster segments into repeats: similarity of the harmony/timbre of two segments,
    # compared bar-against-bar along the diagonal (a repeated chorus lines up bar by bar)
    hu = np.hstack([zscore(chroma), zscore(timbre) * 0.8])
    hu /= np.linalg.norm(hu, axis=1, keepdims=True) + 1e-8

    def seg_sim(p, q):
        """Best bar-by-bar match of two segments, allowing either to slip by up to 2 bars."""
        (a, b), (c, d) = p, q
        best = -1.0
        for lag in range(-2, 3):
            x0, y0 = a + max(lag, 0), c + max(-lag, 0)
            L = min(b - x0, d - y0, 8)
            if L >= 2:
                best = max(best, float(np.mean(np.sum(hu[x0:x0 + L] * hu[y0:y0 + L], axis=1))))
        return best

    SIM = 0.45
    tacet = [bool(drum_on[a:b].mean() < 0.25) for a, b in segs]
    labels, sims = [], np.full((len(segs), len(segs)), -1.0)
    for i, s in enumerate(segs):
        for j in range(i):
            if tacet[i] == tacet[j]:  # a drumless part never repeats a drummed one
                sims[i, j] = sims[j, i] = seg_sim(segs[j], s)
        j = int(np.argmax(sims[i, :i])) if i else -1
        labels.append(labels[j] if i and sims[i, j] > SIM else (max(labels) + 1 if labels else 0))
    if DEBUG:
        print("segments", [(a + 1, b) for a, b in segs])
        print(np.round(sims, 2))

    out = []
    for (a, b), lab, tc in zip(segs, labels, tacet):
        prev = out[-1] if out else None
        # neighbouring pieces of the same section belong together (up to 24 bars)
        if prev and prev["cluster"] == lab and prev["tacet"] == tc and b - prev["from"] + 1 <= 24:
            prev["to"] = b
            prev["loud"] = float(loud[prev["from"] - 1:b].mean())
            continue
        out.append({"from": a + 1, "to": b, "cluster": lab, "loud": float(loud[a:b].mean()), "tacet": tc})
    return name_sections(out)


def name_sections(segs):
    from collections import Counter
    count = Counter(s["cluster"] for s in segs)
    repeated = [c for c, k in count.items() if k > 1]
    loud = {c: np.mean([s["loud"] for s in segs if s["cluster"] == c]) for c in count}
    chorus = max(repeated, key=lambda c: loud[c]) if repeated else None
    others = sorted((c for c in repeated if c != chorus), key=lambda c: -count[c])
    verse = others[0] if others else None

    n = {"Verse": 0, "Chorus": 0}
    for i, s in enumerate(segs):
        c = s["cluster"]
        if i == 0 and (s["tacet"] or c not in (chorus, verse)):
            name = "Intro"
        elif i == len(segs) - 1 and c != chorus:
            name = "Vége" if s["to"] - s["from"] < 6 else "Outro"
        elif c == chorus:
            n["Chorus"] += 1
            name = f"Chorus {n['Chorus']}"
        elif c == verse:
            n["Verse"] += 1
            name = f"Verse {n['Verse']}"
        elif i + 1 < len(segs) and segs[i + 1]["cluster"] == chorus and s["to"] - s["from"] < 10:
            name = "Pre-chorus"
        elif count[c] == 1 and i > len(segs) / 2:
            name = "Bridge"
        else:
            name = f"Szekció {chr(65 + c)}"
        s["name"] = name
    # number Verse/Chorus only when they repeat
    for kind in ("Verse", "Chorus"):
        if n[kind] == 1:
            for s in segs:
                if s["name"] == f"{kind} 1":
                    s["name"] = kind
    return segs


# ---------------------------------------------------------------- main

def analyze(drums, band, device="cpu"):
    """drums/band: float32 (2, n) arrays at 44.1 kHz. Returns the structure dict."""
    n = min(drums.shape[1], band.shape[1])
    drums, band = drums[:, :n], band[:, :n]
    mix = drums + band
    beats, downs = beat_model(device)(mix.T, SR)
    beats, downs = np.asarray(beats), np.asarray(downs)

    starts = assign_bars(beats, downs)
    bar_times = beats[starts]
    bar_len = float(np.median(np.diff(bar_times)))
    # soft intros (free piano, pad) often get no beats: count bars back to where the music starts
    rms = librosa.feature.rms(y=librosa.to_mono(mix), hop_length=512)[0]
    music_start = librosa.frames_to_time(np.argmax(rms > 0.05 * rms.max()), sr=SR, hop_length=512)
    music_end = librosa.frames_to_time(len(rms) - np.argmax(rms[::-1] > 0.05 * rms.max()), sr=SR, hop_length=512)
    while bar_times[0] - bar_len >= music_start - 0.25 * bar_len:
        bar_times = np.insert(bar_times, 0, bar_times[0] - bar_len)
    # same at the end (fade-outs, final held chords)
    while bar_times[-1] + bar_len <= music_end - 0.25 * bar_len:
        bar_times = np.append(bar_times, bar_times[-1] + bar_len)
    bpm = int(round(240 / bar_len))
    # extend one bar past the audio end so every bar has an end time for features
    edges = np.append(bar_times, min(bar_times[-1] + bar_len, n / SR))
    chroma, timbre, loud, drum_rms = bar_features(mix, drums, edges)
    sections = find_sections(chroma, timbre, loud, drum_rms)

    tempo_map = compress_map(bar_times)
    return {
        "bpm": bpm,
        "offset": round(float(bar_times[0]), 2),
        "tempo_map": tempo_map,
        "downbeats": [round(float(t), 2) for t in bar_times],
        "bars": len(bar_times),
        "sections": [{"name": s["name"], "from": int(s["from"]), "to": int(s["to"]), "tacet": bool(s["tacet"])}
                     for s in sections],
        "duration": round(n / SR, 2),
    }


def song_id(title):
    t = re.sub(r"\(.*?\)|\[.*?\]", "", title.split(" - ")[-1]).strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "song"


def split_title(yt_title):
    clean = re.sub(r"\s*[\(\[][^)\]]*(official|video|lyric|audio|remaster|hd|4k)[^)\]]*[\)\]]", "", yt_title, flags=re.I).strip()
    if " - " in clean:
        artist, title = clean.split(" - ", 1)
        return title.strip(), artist.strip()
    return clean, ""


def shift_start(s, n):
    """Renumber bars so that detected bar n+1 becomes bar 1 (drop a lead-in), or n<0 to add bars in front."""
    d = list(s["downbeats"])
    if n > 0:
        d = d[n:]
    elif n < 0:
        step = d[1] - d[0]
        d = [round(d[0] - step * k, 2) for k in range(-n, 0, -1)] + d
    s["downbeats"] = d
    s["bars"] = len(d)
    s["offset"] = d[0]
    s["tempo_map"] = compress_map(np.array(d))
    return s


# A bar of the song plays a part of a pattern: 'key' (its 1st bar) or 'key@n'. Patterns are 1, 2 or 4 bars
# long (len); every bar of a multi-bar pattern becomes its own G entry 'key@n' in the Song Practice block.
def plen(patterns, k):
    return int((patterns.get(k) or {}).get("len") or 1)


def split_ref(r):
    k, _, n = str(r).partition("@")
    return k, int(n) if n.isdigit() else 1


def ref_ok(patterns, r):
    if not r:
        return False
    k, n = split_ref(r)
    return k in patterns and 1 <= n <= plen(patterns, k)


def gkey(patterns, r):
    """The G entry a bar uses: 'key' for a 1-bar pattern, 'key@n' for bar n of a longer one."""
    k, n = split_ref(r)
    return k if plen(patterns, k) == 1 else f"{k}@{n}"


def part_beats(patterns, r):
    k, n = split_ref(r)
    return patterns[k]["beats"][(n - 1) * 4: n * 4]


def score_lines(s, patterns):
    """SCORE entries per section, run-length encoded like the hand-made songs: 'gr', ...rep('gr', 7), 'fill'."""
    lines = []
    for sec in s["sections"]:
        keys = [gkey(patterns, k) if ref_ok(patterns, k) else "rest" for k in sec.get("bars") or []]
        keys += ["rest"] * (sec["to"] - sec["from"] + 1 - len(keys))
        items, i = [], 0
        while i < len(keys):
            j = i
            while j + 1 < len(keys) and keys[j + 1] == keys[i]:
                j += 1
            k = json.dumps(keys[i])
            items.append(k if j == i else f"...rep({k}, {j - i + 1})")
            i = j + 1
        lines.append(f"    {', '.join(items)},   // {sec['from']}–{sec['to']} {sec['name']}")
    return lines


def fill_events(s, patterns):
    """Every run of consecutive fill bars (any fill pattern, all bars of a multi-bar fill) becomes one FILL
    event, named after its first bar; beat = where the first bar departs from the groove before it."""
    flat = flat_keys(s)
    is_fill = lambda r: ref_ok(patterns, r) and patterns[split_ref(r)[0]].get("type") == "fill"
    events, i = [], 0
    while i < len(flat):
        r = flat[i]
        if is_fill(r):
            j = i
            while j + 1 < len(flat) and is_fill(flat[j + 1]):
                j += 1
            ev = {"name": patterns[split_ref(r)[0]]["name"], "kind": "FILL", "from": i + 1, "to": j + 1}
            prev = flat[i - 1] if i else None
            if ref_ok(patterns, prev):
                x, y = part_beats(patterns, prev), part_beats(patterns, r)
                same = 0
                while same < 4 and x[same].split() == y[same].split():
                    same += 1
                if 0 < same < 4:
                    ev["beat"] = same + 1
            events.append(ev)
            i = j + 1
        else:
            i += 1
    return events


def elements(s, patterns):
    """Building blocks for the student's STUDY ELEMENTS view: core patterns in order of first use, each with
    a bar range to loop (groove: its first run, at least the whole pattern and up to 4 bars; fill: the bar
    before it + all of the fill's bars) and its variations (variantOf = this core) the same way."""
    keys = [split_ref(r)[0] if ref_ok(patterns, r) else None for r in flat_keys(s)]

    def loop(key):
        i, n = keys.index(key), plen(patterns, key)
        if patterns[key].get("type") == "fill":
            return [max(1, i), min(len(keys), i + n)]
        j = i
        while j + 1 < len(keys) and keys[j + 1] == key and j - i + 1 < max(n, 4):
            j += 1
        return [i + 1, j + 1]

    def entry(k):
        return {"key": k, "name": patterns[k]["name"], "len": plen(patterns, k), "loop": loop(k)}

    used = list(dict.fromkeys(k for k in keys if k))
    out = []
    for k in used:
        if patterns[k].get("variantOf"):
            continue
        out.append({**entry(k), "type": patterns[k].get("type", "groove"),
                    "variants": [entry(v) for v in used if patterns[v].get("variantOf") == k]})
    # a variation whose core block is never played on its own still needs a home: list it under its core
    for k in used:
        base = patterns[k].get("variantOf")
        if base and base in patterns and not any(e["key"] == base for e in out):
            out.append({"key": base, "name": patterns[base]["name"], "len": plen(patterns, base), "loop": loop(k),
                        "type": patterns[base].get("type", "groove"),
                        "variants": [entry(v) for v in used if patterns[v].get("variantOf") == base]})
    return out


def to_song_block(s, yt_title, sid=None, files=None):
    """Render the structure + sheet as a Song Practice SONGS.push(...) block.
    files: {Drums, Band} audio URLs; default '<id>-drums.mp3' / '<id>-band.mp3' next to the page."""
    title, artist = split_title(yt_title)
    sid = sid or song_id(title)
    files = files or {"Drums": f"{sid}-drums.mp3", "Band": f"{sid}-band.mp3"}
    patterns = s.get("patterns") or {}

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    secs = ",\n".join(
        f"    {{ name: {js(x['name'])}, from: {x['from']}, to: {x['to']}" + (", tacet: true" if x["tacet"] else "") + " }"
        for x in s["sections"])
    tm = ", ".join(f"[{b}, {t}]" for b, t in s["tempo_map"])
    def label(k):
        p = patterns[k]
        base = patterns.get(p.get("variantOf") or "", {})
        return (f"{base['name']} · {p['name']}" if base else p["name"]) + (" (fill)" if p.get("type") == "fill" else "")

    def beats(bts, hands):
        arr = f"[{', '.join(js(b) for b in bts)}]"
        if any("R" in h or "L" in h for h in hands or []):   # kézrend: rides on the array as .hands
            return f"Object.assign({arr}, {{ hands: [{', '.join(js(h) for h in hands)}] }})"
        return arr

    def g_entries(k, p):                       # one G entry per bar: 'key', or 'key@1', 'key@2' … for longer patterns
        n = plen(patterns, k)
        for i in range(1, n + 1):
            part = f" {i}/{n}" if n > 1 else ""
            bts, hands = p["beats"][(i - 1) * 4: i * 4], (p.get("hands") or [])[(i - 1) * 4: i * 4]
            yield f"    {js(gkey(patterns, f'{k}@{i}'))}: {beats(bts, hands)},   // {label(k)}{part}"

    def el_bars(e):                            # the element's bars as G entries — all of them for a multi-bar one
        refs = [gkey(patterns, f"{e['key']}@{i}") for i in range(1, e["len"] + 1)]
        out = f"beats: G[{js(refs[0])}]"
        if len(refs) > 1:
            out += f", bars: [{', '.join(f'G[{js(r)}]' for r in refs)}]"
        return out

    g = "\n".join(line for k, p in patterns.items() for line in g_entries(k, p))
    els = ",\n".join(
        f"    {{ name: {js(e['name'])}, type: {js(e['type'])}, {el_bars(e)}, loop: {js(e['loop'])}, variants: ["
        + ", ".join(f"{{ name: {js(v['name'])}, {el_bars(v)}, loop: {js(v['loop'])} }}" for v in e["variants"]) + "] }"
        for e in elements(s, patterns))
    events = ",\n".join("    { " + ", ".join(f"{k}: {js(v)}" for k, v in e.items()) + " }" for e in fill_events(s, patterns))
    ride = sorted({b for b, r in enumerate(flat_keys(s), 1)
                   if ref_ok(patterns, r) and patterns[split_ref(r)[0]].get("type") != "fill" and "r" in " ".join(part_beats(patterns, r))})
    return f"""/* ---------- {title}{' – ' + artist if artist else ''} ---------- (Drum Split) */
SONGS.push((() => {{
  const BPM = {s['bpm']}, OFFSET = {s['offset']};   // OFFSET = az 1. ütem első leütése (mp)
  /* tempótérkép: [ütem, mp] pontok, köztük lineáris; az utolsó pont után állandó {s['bpm']} BPM */
  const TEMPO_MAP = [{tm}];
  const FILES = {{ Drums: '{files["Drums"]}', Band: '{files["Band"]}' }};
  const SECTIONS = [
{secs}
  ];
  const EVENTS = [
{events}
  ];
  const G = {{
    rest: ['-', '-', '-', '-'],
{g}
  }};
  const rep = (k, n) => Array(n).fill(k);
  const SCORE = [null,                                                     // 1-től indexelve
{chr(10).join(score_lines(s, patterns))}
  ].map(k => k && G[k]);
  /* építőelemek a tanuló STUDY ELEMENTS nézetéhez: loop = a gyakorláskor ismételt ütemek */
  const ELEMENTS = [
{els}
  ];
  return {{
    id: '{sid}', title: {js(title)}, artist: {js(artist)}, info: {js((artist + ' · ' if artist else '') + f"{s['bpm']} BPM · 4/4")}, tags: ['4/4'],
    bpm: BPM, offset: OFFSET, tempoMap: TEMPO_MAP, files: FILES,
    sections: SECTIONS, events: EVENTS, score: SCORE, rideBars: new Set({js(ride)}), elements: ELEMENTS,
  }};
}})());
"""


def flat_keys(s):
    """Pattern key of every bar in song order (None = rest). A tacet section only means the drummer mostly
    sits out: a pickup written into it (e.g. Snow bar 4) still plays."""
    out = []
    for sec in s["sections"]:
        keys = list(sec.get("bars") or [])[: sec["to"] - sec["from"] + 1]
        keys += [None] * (sec["to"] - sec["from"] + 1 - len(keys))
        out += keys
    return out
