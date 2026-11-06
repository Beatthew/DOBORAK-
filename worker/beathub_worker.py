"""BEATHUB feldolgozó: a gépen fut, a Tananyag → Dalok oldalon beadott linkeket dolgozza fel.

Ugyanaz, mint a Song Practice szervere (server.py run_job), csak a munka a Supabase-ből jön és oda megy vissza:
  1. a songs táblában 'queued' sort vesz fel (a Dalok oldal teszi oda),
  2. letölti a YouTube hangot (yt-dlp), szétválasztja dobra és bandre (Demucs htdemucs, a GPU-n),
  3. megkeresi az ütemeket és a szekciókat (structure.analyze, beat_this),
  4. a két sávot a „songs” tárhelyre tölti (songs/<id>/drums.mp3, band.mp3), a szerkezetet a structure oszlopba írja.
Közben a status / progress mezőt frissíti (a Dalok oldal élőben mutatja), és életjelet ad (worker_status).

Indítás: start-worker.bat (a repó gyökerében). A worker/.env-ben kell: SUPABASE_URL és SUPABASE_SERVICE_KEY.
"""
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import requests
import torch
import yt_dlp
from demucs.apply import apply_model
from demucs.pretrained import get_model

import structure

ROOT = Path(__file__).parent
WORK = ROOT / "work"   # work/<videoId>/{source.mp3, drums.mp3, band.mp3}: helyben marad, újrafeldolgozásnál nem kell újra letölteni
WORK.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SR = 44100
POLL = 5          # mp: ilyen sűrűn néz új munkát
BUSY = ("downloading", "separating", "analyzing")


def load_env():
    env = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    env.update({k: v for k, v in os.environ.items() if k.startswith("SUPABASE_")})
    url, key = env.get("SUPABASE_URL", "").rstrip("/"), env.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        sys.exit("Hiányzik a worker/.env: SUPABASE_URL és SUPABASE_SERVICE_KEY (Supabase → Project Settings → API Keys → Secret keys).")
    return url, key


URL, KEY = load_env()
# az új „sb_secret_…” kulcs csak apikey fejlécként megy; a régi service_role JWT Bearer-ként is
H = {"apikey": KEY, **({"Authorization": f"Bearer {KEY}"} if KEY.startswith("eyJ") else {})}


# ---------------------------------------------------------------- Supabase

def rest(method, path, **kw):
    r = requests.request(method, f"{URL}/rest/v1/{path}", headers={**H, "Content-Type": "application/json", **kw.pop("headers", {})}, timeout=30, **kw)
    r.raise_for_status()
    return r.json() if r.content else None


def update(vid, **fields):
    rest("PATCH", f"songs?id=eq.{vid}", data=json.dumps(fields))


def upload(path, local):
    with open(local, "rb") as f:
        r = requests.post(f"{URL}/storage/v1/object/songs/{path}", data=f,
                          headers={**H, "Content-Type": "audio/mpeg", "x-upsert": "true"}, timeout=600)
    r.raise_for_status()


def heartbeat():
    while True:
        try:
            rest("POST", "worker_status", data=json.dumps({"id": 1, "last_seen": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "device": f"{socket.gethostname()} · {DEVICE}"}),
                 headers={"Prefer": "resolution=merge-duplicates"})
        except Exception as exc:
            print(f"életjel hiba: {exc}")
        time.sleep(20)


# ---------------------------------------------------------------- feldolgozás (a Song Practice server.py-ból)

_model = None


def model():
    global _model
    if _model is None:
        _model = get_model("htdemucs")
        _model.to(DEVICE).eval()
    return _model


def decode(path):
    """Decode any audio file to a float32 (2, n) array at 44.1 kHz via ffmpeg."""
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy()


def encode_mp3(audio, path):
    pcm = np.ascontiguousarray(np.clip(audio, -1, 1).T, dtype=np.float32).tobytes()
    subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-",
         "-codec:a", "libmp3lame", "-b:a", "192k", str(path)],
        input=pcm, check=True,
    )


def separate(src, out_dir):
    m = model()
    wav = torch.from_numpy(decode(src))
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    with torch.no_grad():
        stems = apply_model(m, ((wav - mean) / std)[None], device=DEVICE, split=True, overlap=0.25, progress=False)[0]
    stems = (stems * std + mean).cpu()
    drums_idx = m.sources.index("drums")
    drums = stems[drums_idx]
    band = stems.sum(0) - drums  # vocals + bass + other
    encode_mp3(drums.numpy(), out_dir / "drums.mp3")
    encode_mp3(band.numpy(), out_dir / "band.mp3")


def run_job(row):
    sid, vid = row["id"], row["video_id"]
    out_dir = WORK / vid
    out_dir.mkdir(exist_ok=True)
    last = [0.0]

    def hook(d):
        total = d.get("total_bytes") or d.get("total_bytes_estimate")
        if d["status"] == "downloading" and total and time.time() - last[0] > 1:
            last[0] = time.time()
            update(sid, progress=round(d.get("downloaded_bytes", 0) * 100 / total))

    opts = {
        "ffmpeg_location": FFMPEG,
        "format": "bestaudio/best",
        "outtmpl": str(out_dir / "source.%(ext)s"),
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
        "progress_hooks": [hook],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
            title, artist = structure.split_title(info.get("title") or vid)
            update(sid, status="downloading", progress=0, title=title, artist=artist, error=None)
            if not (out_dir / "source.mp3").exists():
                ydl.process_ie_result(info, download=True)
        update(sid, status="separating", progress=0)
        if not ((out_dir / "drums.mp3").exists() and (out_dir / "band.mp3").exists()):
            separate(out_dir / "source.mp3", out_dir)
        update(sid, status="analyzing", progress=0)
        s = structure.analyze(decode(out_dir / "drums.mp3"), decode(out_dir / "band.mp3"), device=DEVICE)
        upload(f"{sid}/drums.mp3", out_dir / "drums.mp3")
        upload(f"{sid}/band.mp3", out_dir / "band.mp3")
        update(sid, status="done", progress=100, structure=s)
        print(f"kész: {title} ({sid})")
    except Exception as exc:  # yt-dlp / ffmpeg / modell hibák a Dalok oldalon jelennek meg
        traceback.print_exc()
        update(sid, status="error", error=re.sub(r"\x1b\[[0-9;]*m", "", str(exc))[:500])


def next_job():
    rows = rest("GET", "songs?status=eq.queued&video_id=not.is.null&order=created_at&limit=1&select=id,video_id")
    if not rows:
        return None
    # felvétel: csak ha még mindig várakozik (két worker sem viheti el kétszer)
    got = rest("PATCH", f"songs?id=eq.{rows[0]['id']}&status=eq.queued", data=json.dumps({"status": "downloading", "progress": 0}),
               headers={"Prefer": "return=representation"})
    return got[0] if got else None


def main():
    print(f"BEATHUB feldolgozó · {DEVICE} · {URL}")
    # ami egy leállás miatt félbemaradt, az újra sorra kerül
    rest("PATCH", "songs?status=in.(downloading,separating,analyzing)", data=json.dumps({"status": "queued", "progress": 0}))
    threading.Thread(target=heartbeat, daemon=True).start()
    while True:
        try:
            row = next_job()
            if row:
                print(f"feldolgozás: {row['video_id']}")
                run_job(row)
                continue
        except requests.RequestException as exc:
            print(f"Supabase hiba: {exc}")
        time.sleep(POLL)


if __name__ == "__main__":
    main()
