param([Parameter(Mandatory=$true)][string]$Task, [string]$In = 'C:\Hecate-Umbra\sites\garter-black-v3', [string]$Profile = 'hecate-umbra-casual', [string]$Model = 'deepseek-v4.1-flash')
# Launches one OpenCode Go DeepSeek Flash worker (Umbra soul) in the background on a task brief.
$root = 'C:\Hecate-Umbra\sites\garter-black-v3'
$hermes = "$env:LOCALAPPDATA\hermes\bin\hermes.exe"
$logs = "$root\tasks\logs"; New-Item -ItemType Directory -Force $logs | Out-Null
$brief = "$root\tasks\TASK-$Task.md"
if (-not (Test-Path $brief)) { "NO BRIEF $brief"; exit 1 }
$prompt = "You are an Umbra build worker for Rio (Pitch Black Industries). Your assignment is the brief at $brief . Read it in full, then read $root\tasks\CONVENTIONS.md in full, then execute the brief completely and autonomously: do every step, test your work, fix what fails, and finish by writing the report file the brief names and storing the cortex summary. Do not stop to ask questions; make the most reasonable choice, record it in the report, and keep going. Do not deploy anything. Do not print secrets."
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = "$logs\$Task-$stamp.out.log"; $err = "$logs\$Task-$stamp.err.log"
$argline = "-p $Profile -z `"$prompt`" -m $Model --provider opencode-go --yolo --in `"$In`""
$p = Start-Process -FilePath $hermes -ArgumentList $argline -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
"$Task started pid=$($p.Id) out=$out"
Set-Content -Path "$logs\$Task.pid" -Value $p.Id
