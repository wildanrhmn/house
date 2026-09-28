import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Everything the live showcase needs, in one terminal:
//   relay  local stand-in for the Shannon WebSocket, forwarding over HTTP
//   desk   backup desk on http://localhost:3000, going through the relay
//   1h/4h  demo takers watching BTC 1 hour and BTC 4 hours
// The public site keeps using the public socket. Ctrl+C stops all of it,
// and `npm run showcase:stop` clears anything left over.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RELAY = "ws://127.0.0.1:8546";
const WATCH_MIN = process.env.TAKE_WATCH_MIN ?? "120";
const WIN = process.platform === "win32";

type Job = { name: string; cmd: string; env?: Record<string, string>; quiet?: RegExp };

const JOBS: Job[] = [
  { name: "relay", cmd: "npm run relay" },
  { name: "desk ", cmd: "npm run dev", env: { NEXT_PUBLIC_WS_RPC_URL: RELAY }, quiet: /Compiling|Compiled|GET \/|✓ Starting|Local:|Network:|Environments|Experiments|telemetry/i },
  { name: "1h   ", cmd: "npm run take -- --watch", env: { WS_RPC_URL: RELAY, HOUSE_MARKET: "btc-1h", TAKE_WATCH_MIN: WATCH_MIN } },
  { name: "4h   ", cmd: "npm run take -- --watch", env: { WS_RPC_URL: RELAY, HOUSE_MARKET: "btc-4h", TAKE_WATCH_MIN: WATCH_MIN } },
];

const children: ChildProcess[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function portBusy(port: number): Promise<boolean> {
  return new Promise((done) => {
    const sock = createConnection({ host: "127.0.0.1", port });
    sock.once("connect", () => {
      sock.destroy();
      done(true);
    });
    sock.once("error", () => done(false));
  });
}

function start(job: Job) {
  const child = spawn(job.cmd, { cwd: ROOT, env: { ...process.env, ...job.env }, shell: true });
  const print = (buf: Buffer) => {
    for (const line of String(buf).split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith(">") || t.includes("Assertion failed")) continue;
      if (job.quiet?.test(t)) continue;
      console.log(`[${job.name}] ${t}`);
    }
  };
  child.stdout?.on("data", print);
  child.stderr?.on("data", print);
  child.on("exit", (code) => console.log(`[${job.name}] stopped (${code ?? "signal"})`));
  children.push(child);
}

function stopAll() {
  for (const c of children) {
    if (!c.pid || c.exitCode !== null) continue;
    if (WIN) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  console.log("stopping everything");
  stopAll();
  process.exit(0);
});

const busy = [];
if (await portBusy(8546)) busy.push("8546 (relay)");
if (await portBusy(3000)) busy.push("3000 (desk)");
if (busy.length) {
  console.log(`Already in use: ${busy.join(", ")}. Something from an earlier run is still going.`);
  console.log("Run   npm run showcase:stop   then   npm run showcase   again.");
  process.exit(1);
}

console.log("HOUSE showcase starting: relay, backup desk on http://localhost:3000, takers for BTC 1h and 4h.");
console.log("Leave this window open. Ctrl+C stops everything.");
start(JOBS[0]);
await sleep(2500);
for (const job of JOBS.slice(1)) start(job);

for (let i = 0; i < 90; i++) {
  await sleep(2000);
  if (await portBusy(3000)) {
    console.log("READY. Backup desk: http://localhost:3000/desk?m=btc-1h");
    break;
  }
}
