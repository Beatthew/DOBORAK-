@echo off
rem BEATHUB feldolgozó: a Tananyag -> Dalok oldalon beadott linkeket dolgozza fel ezen a gépen (GPU).
rem A Song Practice Python környezetét használja (PyTorch CUDA, Demucs, beat_this, yt-dlp).
cd /d "%~dp0worker"
set PY=%~dp0..\SONGPRACTICE APP\songpractice\.venv\Scripts\python.exe
if not exist "%PY%" (
  echo Nem talalom a Song Practice Python kornyezetet: %PY%
  pause
  exit /b 1
)
"%PY%" beathub_worker.py
pause
