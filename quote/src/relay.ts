import { WebSocketServer, type WebSocket } from "ws";

// A local stand-in for Shannon's WebSocket RPC. The DreamDEX SDK only talks
// over a WebSocket, and the public one has gone quiet for minutes at a time
// while the HTTP endpoints stayed healthy. This speaks WebSocket to the SDK and
// forwards every call over HTTP. Subscriptions (newHeads, logs) are served by
// polling, since HTTP cannot push.
//
//   npm run relay
//   $env:WS_RPC_URL="ws://127.0.0.1:8546"            for the Node scripts
//   $env:NEXT_PUBLIC_WS_RPC_URL="ws://127.0.0.1:8546" for npm run dev
//
// Without those variables nothing uses it.

const PORT = Number(process.env.RELAY_PORT ?? 8546);
const UPSTREAMS = (process.env.RELAY_UPSTREAMS ?? "https://api.infra.testnet.somnia.network,https://dream-rpc.somnia.network")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const POLL_MS = 500;
const TIMEOUT_MS = 8000;

type Rpc = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: unknown[] };
type Sub = { ws: WebSocket; kind: "newHeads" | "logs"; filter?: Record<string, unknown>; from?: bigint };

const stamp = () => new Date().toISOString().slice(11, 19) + "Z";
let preferred = 0;

async function upstream(body: unknown): Promise<unknown> {
  let last: unknown;
  for (let i = 0; i < UPSTREAMS.length; i++) {
    const idx = (preferred + i) % UPSTREAMS.length;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(UPSTREAMS[idx], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (idx !== preferred) {
        console.log(stamp(), "upstream now", UPSTREAMS[idx]);
        preferred = idx;
      }
      return json;
    } catch (err) {
      last = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function call(method: string, params: unknown[] = []): Promise<any> {
  const out = (await upstream({ jsonrpc: "2.0", id: 1, method, params })) as { result?: unknown; error?: { message: string } };
  if (out.error) throw new Error(out.error.message);
  return out.result;
}

const subs = new Map<string, Sub>();
let nextSub = 1;

function notify(sub: Sub, id: string, result: unknown) {
  if (sub.ws.readyState !== sub.ws.OPEN) return;
  sub.ws.send(JSON.stringify({ jsonrpc: "2.0", method: "eth_subscription", params: { subscription: id, result } }));
}

let lastHead = -1n;
let polling = false;

async function poll() {
  if (polling || subs.size === 0) return;
  polling = true;
  try {
    const head = BigInt(await call("eth_blockNumber"));
    if (head <= lastHead) return;
    const heads = [...subs.entries()].filter(([, s]) => s.kind === "newHeads");
    if (heads.length) {
      const block = await call("eth_getBlockByNumber", ["0x" + head.toString(16), false]);
      if (block) for (const [id, s] of heads) notify(s, id, block);
    }
    for (const [id, s] of subs) {
      if (s.kind !== "logs") continue;
      const from = s.from ?? head;
      if (from > head) continue;
      const to = from + 900n < head ? from + 900n : head;
      const logs = (await call("eth_getLogs", [{ ...s.filter, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }])) as unknown[];
      for (const log of logs) notify(s, id, log);
      s.from = to + 1n;
    }
    lastHead = head;
  } catch (err) {
    console.log(stamp(), "poll failed:", err instanceof Error ? err.message.split("\n")[0] : String(err));
  } finally {
    polling = false;
  }
}

setInterval(() => void poll(), POLL_MS);

async function handle(ws: WebSocket, msg: Rpc): Promise<unknown> {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  if (msg.method === "eth_subscribe") {
    const [kind, filter] = (msg.params ?? []) as [string, Record<string, unknown>?];
    if (kind !== "newHeads" && kind !== "logs") {
      return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `subscription ${kind} not supported by relay` } };
    }
    const id = "0x" + (nextSub++).toString(16);
    let from: bigint | undefined;
    if (kind === "logs") {
      try {
        from = BigInt(await call("eth_blockNumber")) + 1n;
      } catch {
        from = undefined;
      }
    }
    subs.set(id, { ws, kind, filter: kind === "logs" ? { address: filter?.address, topics: filter?.topics } : undefined, from });
    return reply(id);
  }
  if (msg.method === "eth_unsubscribe") {
    const id = String((msg.params ?? [])[0]);
    return reply(subs.delete(id));
  }
  try {
    return await upstream(msg);
  } catch (err) {
    return { jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: `relay: ${err instanceof Error ? err.message : String(err)}` } };
  }
}

const server = new WebSocketServer({ host: "127.0.0.1", port: PORT });
server.on("connection", (ws) => {
  console.log(stamp(), "client connected");
  ws.on("message", async (data) => {
    let parsed: Rpc | Rpc[];
    try {
      parsed = JSON.parse(String(data));
    } catch {
      return;
    }
    const out = Array.isArray(parsed) ? await Promise.all(parsed.map((m) => handle(ws, m))) : await handle(ws, parsed);
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(out));
  });
  ws.on("close", () => {
    for (const [id, s] of subs) if (s.ws === ws) subs.delete(id);
  });
});

console.log(stamp(), `relay on ws://127.0.0.1:${PORT}, forwarding to ${UPSTREAMS.join(" then ")}`);
