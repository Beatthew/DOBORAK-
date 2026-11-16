# A BEATHUB feldolgozó ablak nélkül, a háttérben (a Windows indításából ez fut).
# A kimenete a worker/work/worker.log fájlba megy. Ha már fut egy példány, nem indít másodikat.
$ErrorActionPreference = 'Stop'
$running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*beathub_worker.py*' }
if ($running) { exit 0 }

$root = Split-Path $PSScriptRoot -Parent
$py = Join-Path $root '..\SONGPRACTICE APP\songpractice\.venv\Scripts\python.exe'
$log = Join-Path $PSScriptRoot 'work\worker.log'
New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'work') | Out-Null
Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUNBUFFERED = '1'
"--- indítás: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $log -Append -Encoding utf8
& $py beathub_worker.py *>> $log
