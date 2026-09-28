import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Stops every HOUSE process from this repo: relay, desk, takers, showcase.
// Leaves this process itself alone.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

if (process.platform !== "win32") {
  spawnSync("pkill", ["-f", `${ROOT}.*(relay|take|showcase|next)`], { stdio: "inherit" });
  process.exit(0);
}

const root = ROOT.replace(/\\/g, "\\\\");
const ps = `
$me = ${process.pid}
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.ProcessId -ne $me -and $_.CommandLine -and $_.CommandLine -match [regex]::Escape('${root}'.Replace('\\\\','\\')) -and $_.CommandLine -match 'relay|take|showcase|next' -and $_.CommandLine -notmatch 'showcase-stop'
}
$n = @($procs).Count
$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
"stopped $n HOUSE process(es)"
`;
const out = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
console.log((out.stdout || out.stderr || "").trim());
