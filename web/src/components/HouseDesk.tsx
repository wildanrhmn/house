"use client";

import { toHuman } from "@somnia-chain/markets-sdk";
import {
  useLiveBinaryOrderBookByMarket,
  useLiveFills,
  useLivePrice,
  useLivePriceTicks,
  useWatchMarket,
  useWatchPrice,
  useWatchUser,
} from "@somnia-chain/markets-sdk/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, erc20Abi, http, type Address } from "viem";
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import {
  CHAIN,
  DEFAULT_HALF_SPREAD,
  DEFAULT_QUOTE_SIZE,
  HTTP_RPC_URL,
  TUSDC,
  minLeftSec,
} from "@/lib/config";
import { discoverWindow, openingPrice, type HouseWindow } from "@/lib/discover";
import { createSignedExchange, getReadExchange } from "@/lib/exchange";
import {
  cancelOwn,
  flattenInventory,
  planQuotes,
  quoteWithRetry,
  redeemSettled,
  restingQuotes,
  type QuotePlan,
  type Resting,
} from "@/lib/house";
import { fairYes } from "@/lib/quoting";

gsap.registerPlugin(useGSAP);

type Tone = "up" | "down" | "warn";
type Ev = { id: number; t: number; text: string; tone?: Tone };
type Level = { price: number; qty: number; mine?: Resting; ghost?: boolean };

const pc = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });
const EMPTY_BOOK = { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };

export function HouseDesk() {
  const root = useRef<HTMLElement>(null);
  const [live, setLive] = useState<HouseWindow | null>(null);
  const [openPx, setOpenPx] = useState<number | null>(null);
  const [plan, setPlan] = useState<QuotePlan | null>(null);
  const [inv, setInv] = useState({ up: 0, down: 0 });
  const [resting, setResting] = useState<Resting[]>([]);
  const [collateral, setCollateral] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [kept, setKept] = useState(0);
  const [chip, setChip] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [sizeText, setSizeText] = useState(String(DEFAULT_QUOTE_SIZE));
  const [spreadText, setSpreadText] = useState(String(DEFAULT_HALF_SPREAD));
  const size = parseNum(sizeText, DEFAULT_QUOTE_SIZE);
  const spread = parseNum(spreadText, DEFAULT_HALF_SPREAD);
  const evId = useRef(0);
  const lastSets = useRef(-1);
  const lastMarket = useRef<string | null>(null);

  const { address: connected, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  // /desk?watch=0x... follows a wallet read-only, for a judge or a demo that
  // watches the Node quoter. Actions still need a connected wallet.
  const [watch, setWatch] = useState<Address | undefined>(undefined);
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("watch");
    if (w && /^0x[0-9a-fA-F]{40}$/.test(w)) setWatch(w as Address);
  }, []);
  const address = connected ?? watch;

  useWatchPrice(live?.asset);
  useWatchMarket(live?.pool);
  useWatchUser(address);
  const livePx = useLivePrice(live?.asset);
  const ticks = useLivePriceTicks(live?.asset, 120);
  const liveBook = useLiveBinaryOrderBookByMarket(live?.marketId, 8);
  const book = liveBook ?? EMPTY_BOOK;
  const fills = useLiveFills(live?.pool, 20);

  const d = live?.quoteDecimals ?? 6;
  const toN = useCallback((v: bigint | string) => Number(toHuman(v, d)), [d]);
  const remaining = live ? live.expiry - now : 0;
  const headroom = live ? minLeftSec(live.intervalSec) : 0;
  const phase = !live ? "arming" : remaining <= 0 ? "locked" : remaining <= headroom ? "locking" : "trading";

  const log = useCallback((text: string, tone?: Tone) => {
    setEvents((e) => [{ id: ++evId.current, t: Date.now(), text, tone }, ...e].slice(0, 7));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".pit-top", { autoAlpha: 0, y: -8, duration: 0.6, ease: "power2.out" });
        gsap.from(".pit-window > *, .pit-book, .pit-house > *", {
          autoAlpha: 0,
          y: 18,
          duration: 0.8,
          stagger: 0.06,
          ease: "power3.out",
          delay: 0.15,
        });
        gsap.from(".pit-tape", { autoAlpha: 0, duration: 0.8, delay: 0.7 });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const refreshWindow = useCallback(async () => {
    try {
      const exchange = getReadExchange();
      const next = await discoverWindow(exchange);
      setLive(next);
      if (next) {
        if (lastMarket.current && lastMarket.current !== next.marketId) {
          log(`A new ${next.asset} ${fmtInterval(next.intervalSec)} window opened.`);
        }
        lastMarket.current = next.marketId;
        const open = await openingPrice(exchange, next.marketId);
        setOpenPx(open);
        const p = await planQuotes(exchange, next, spread, size);
        setPlan(p);
      } else {
        setOpenPx(null);
        setPlan(null);
      }
    } catch (err) {
      log(err instanceof Error ? err.message : String(err), "warn");
    }
  }, [size, spread, log]);

  useEffect(() => {
    void refreshWindow();
    const id = setInterval(() => void refreshWindow(), 12_000);
    return () => clearInterval(id);
  }, [refreshWindow]);

  // Everything about this wallet, read at chain head: outcome balances,
  // resting quotes, collateral. Also where a freshly minted set is noticed.
  const refreshMine = useCallback(async () => {
    if (!live || !address) {
      setInv({ up: 0, down: 0 });
      setResting([]);
      setCollateral(null);
      lastSets.current = -1;
      return;
    }
    try {
      const ex = getReadExchange();
      const pool = live.pool as Address;
      const oc = await ex.client.getMarketOnchain(live.marketId);
      const [up, down, r, bal] = await Promise.all([
        ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: address, id: oc.yesId }),
        ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: address, id: oc.noId }),
        restingQuotes(ex, pool, address),
        pc.readContract({ address: TUSDC, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      ]);
      const u = toN(up);
      const dn = toN(down);
      setInv({ up: u, down: dn });
      setResting(r.orders);
      setCollateral(Number(toHuman(bal, 6)));
      const sets = Math.min(u, dn);
      if (lastSets.current >= 0 && sets > lastSets.current) {
        const n = sets - lastSets.current;
        setChip(`A set was minted to you`);
        log(`${fmt(n)} complete set${n === 1 ? "" : "s"} minted to you.`, "up");
      }
      lastSets.current = sets;
    } catch (err) {
      log(err instanceof Error ? err.message : String(err), "warn");
    }
  }, [live, address, toN, log]);

  useEffect(() => {
    void refreshMine();
    const id = setInterval(() => void refreshMine(), 6_000);
    return () => clearInterval(id);
  }, [refreshMine]);

  useEffect(() => {
    if (!chip) return;
    const id = setTimeout(() => setChip(null), 2_800);
    return () => clearTimeout(id);
  }, [chip]);

  const yesBid = book.yesBids[0] ? toN(book.yesBids[0].price) : undefined;
  const yesAsk = book.yesAsks[0] ? toN(book.yesAsks[0].price) : undefined;
  const mineBid = resting.find((o) => o.isBid);
  const mineAsk = resting.find((o) => !o.isBid);
  const bothResting = !!mineBid && !!mineAsk;

  const displayPlan = useMemo(() => {
    if (plan) return plan;
    const fair = fairYes(yesBid, yesAsk);
    return { bidYes: fair - spread, askYes: fair + spread, size, fair };
  }, [plan, yesBid, yesAsk, spread, size]);

  const perSet = useMemo(() => {
    if (mineBid && mineAsk) return Math.max(0, toN(mineAsk.price) - toN(mineBid.price));
    return Math.max(0, displayPlan.askYes - displayPlan.bidYes);
  }, [mineBid, mineAsk, displayPlan, toN]);
  const sets = Math.min(inv.up, inv.down);
  const unmatched = Math.abs(inv.up - inv.down);
  const unmatchedSide = inv.up > inv.down ? "YES" : "NO";

  const ladder = useMemo(() => {
    const key = (p: number) => Math.round(p * 1000);
    const asks: Level[] = book.yesAsks.slice(0, 5).map((l) => ({ price: toN(l.price), qty: toN(l.quantity) }));
    const bids: Level[] = book.yesBids.slice(0, 5).map((l) => ({ price: toN(l.price), qty: toN(l.quantity) }));
    const place = (rows: Level[], row: Level, asc: boolean) => {
      const hit = rows.find((r) => key(r.price) === key(row.price));
      if (hit) {
        hit.mine = row.mine;
        hit.ghost = row.ghost;
        return;
      }
      rows.push(row);
      rows.sort((a, b) => (asc ? a.price - b.price : b.price - a.price));
    };
    const showGhosts = !!live && !!plan && phase === "trading";
    if (mineAsk) place(asks, { price: toN(mineAsk.price), qty: toN(mineAsk.quantity), mine: mineAsk }, true);
    else if (showGhosts) place(asks, { price: plan.askYes, qty: size, ghost: true }, true);
    if (mineBid) place(bids, { price: toN(mineBid.price), qty: toN(mineBid.quantity), mine: mineBid }, false);
    else if (showGhosts) place(bids, { price: plan.bidYes, qty: size, ghost: true }, false);
    const max = Math.max(1, ...asks.map((l) => l.qty), ...bids.map((l) => l.qty));
    return { asks: asks.slice(0, 6).reverse(), bids: bids.slice(0, 6), max };
  }, [book, mineAsk, mineBid, plan, live, phase, size, toN]);

  const spark = useMemo(() => {
    const pts = [...ticks].sort((a, b) => a.blockTimestamp - b.blockTimestamp).map((t) => t.price);
    if (livePx?.price) pts.push(livePx.price);
    const series = pts.slice(-120);
    if (series.length < 2) return null;
    const all = openPx != null ? [...series, openPx] : series;
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    const pad = Math.max((hi - lo) * 0.2, hi * 0.0002);
    lo -= pad;
    hi += pad;
    const x = (i: number) => (i / (series.length - 1)) * 300;
    const y = (p: number) => 90 - ((p - lo) / (hi - lo)) * 90;
    const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
    return { path, openY: openPx != null ? y(openPx) : null, lastY: y(series[series.length - 1]) };
  }, [ticks, livePx, openPx]);

  const run = async (label: "quote" | "flatten" | "redeem" | "pull") => {
    if (!walletClient) {
      log("Connect a wallet first.", "warn");
      return;
    }
    if (!live && label !== "redeem") {
      log("No live window yet.", "warn");
      return;
    }
    setBusy(label);
    try {
      const signed = createSignedExchange({ walletClient });
      if (label === "quote" && live) {
        await cancelOwn(signed, live);
        const result = await quoteWithRetry(signed, live, spread, size);
        if (!result.plan) {
          log("Too close to the lock, or the book has no fair price.", "warn");
          return;
        }
        if (result.upId && result.downId) {
          log(`Resting at ${result.plan.bidYes.toFixed(3)} and ${result.plan.askYes.toFixed(3)}.`, "up");
        } else {
          log(`Only one side rested. ${result.skipped.join(". ")}.`, "warn");
        }
      } else if (label === "flatten" && live) {
        const out = await flattenInventory(signed, live);
        const merged = toN(out.merged);
        const sold = toN(out.soldUp + out.soldDown);
        if (merged > 0) setKept((k) => k + merged * perSet);
        const parts = [
          merged > 0 ? `Merged ${fmt(merged)} set${merged === 1 ? "" : "s"} back to collateral` : null,
          sold > 0 ? `sold ${fmt(sold)} leftover` : null,
        ].filter(Boolean);
        log(parts.length ? `${parts.join(", ")}.` : "Nothing to flatten.", merged > 0 ? "up" : undefined);
        lastSets.current = 0;
      } else if (label === "pull" && live) {
        const n = await cancelOwn(signed, live);
        log(n ? `Pulled ${n} quote${n === 1 ? "" : "s"}.` : "No quotes to pull.");
      } else if (label === "redeem") {
        const n = await redeemSettled(signed);
        log(n === 0 ? "Nothing to redeem yet." : `Redeemed ${n} payout${n === 1 ? "" : "s"}.`, n ? "up" : undefined);
      }
      await refreshMine();
      await refreshWindow();
    } catch (err) {
      log(err instanceof Error ? err.message : String(err), "warn");
    } finally {
      setBusy(null);
    }
  };

  const btc = livePx?.price ?? null;
  const vsOpen = btc != null && openPx != null && openPx !== 0 ? ((btc - openPx) / openPx) * 100 : null;
  const upside = vsOpen == null || vsOpen >= 0;
  const ringT = live && live.intervalSec > 0 ? Math.max(0, Math.min(1, remaining / live.intervalSec)) : 0;
  const C = 2 * Math.PI * 64;
  const canQuote = !!live && phase === "trading" && !busy;

  const hint = !live
    ? { text: "The desk is finding the next window.", warn: false }
    : phase === "locked"
      ? { text: "This window locked. The next one opens on its own.", warn: true }
      : phase === "locking"
        ? { text: `The window locks in ${Math.ceil(remaining)} seconds, so quoting is closed.`, warn: true }
        : !isConnected && watch
          ? { text: `Following ${short(watch)}. Connect a wallet to act.`, warn: false }
          : !isConnected
            ? { text: "Connect a Shannon wallet to sit on both sides of this book.", warn: false }
            : bothResting
              ? { text: "Both sides are resting. Anyone who crosses mints a set to you.", warn: false }
              : { text: "Quote both sides to sit one tick inside the market.", warn: false };

  const caption = bothResting
    ? `Resting ${fmt(toN(mineBid!.quantity))} a side at ${toN(mineBid!.price).toFixed(3)} and ${toN(mineAsk!.price).toFixed(3)}. Each fill pair keeps ${perSet.toFixed(3)}.`
    : `Rests ${fmt(size)} a side at ${displayPlan.bidYes.toFixed(3)} and ${displayPlan.askYes.toFixed(3)}. Keeps ${perSet.toFixed(3)} a set.`;

  return (
    <main ref={root} className="pit">
      <div className="pit-glow" aria-hidden="true" />
      <div className="pit-grain" aria-hidden="true" />

      <header className="pit-top">
        <Link className="pit-mark" href="/">
          HOUSE
        </Link>
        <p className="pit-status">
          <i className={`pit-lamp ${phase === "trading" ? "is-live" : phase === "locking" ? "is-lock" : ""}`} />
          {live ? `${live.asset} ${fmtInterval(live.intervalSec)}, ${phase}` : "finding a window"}
        </p>
        <div className="pit-wallet">
          {address ? (
            <>
              {collateral != null ? (
                <span className="pit-bal">
                  {fmt(collateral)} <span>tUSDC</span>
                </span>
              ) : null}
              <span className="pit-addr">{isConnected ? short(address) : `following ${short(address)}`}</span>
              {isConnected ? (
                <button type="button" className="ghost" onClick={() => disconnect()}>
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className="solid"
                  onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                >
                  Connect wallet
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="solid"
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
            >
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <section className="pit-stage">
        <aside className="pit-window">
          <div className={`pit-ring ${phase === "locking" ? "is-lock" : phase === "trading" ? "" : "is-off"}`}>
            <svg viewBox="0 0 140 140" aria-hidden="true">
              <circle className="track" cx="70" cy="70" r="64" />
              <circle
                className="arc"
                cx="70"
                cy="70"
                r="64"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - ringT)}
              />
            </svg>
            <div className="pit-ring-face">
              <strong>{live && remaining > 0 ? clock(remaining) : "00:00"}</strong>
              <span>{phase === "locked" ? "locked" : live ? `closes ${stampShort(live.expiry)}` : "no window"}</span>
            </div>
          </div>

          <div className="pit-px">
            <span className="pit-k">{live ? `${live.asset} against the open` : "Index"}</span>
            <strong>{btc == null ? "–" : btc.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
            <span className={`pit-delta ${upside ? "up" : "down"}`}>
              {vsOpen == null
                ? "waiting for the open"
                : `${vsOpen >= 0 ? "+" : ""}${vsOpen.toFixed(3)}% from ${openPx?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            </span>
          </div>

          <svg
            className={`pit-spark ${upside ? "" : "down"}`}
            viewBox="0 0 300 90"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {spark ? (
              <>
                <path className="fill" d={`${spark.path} L300,90 L0,90 Z`} />
                {spark.openY != null ? (
                  <line className="open" x1="0" x2="300" y1={spark.openY} y2={spark.openY} />
                ) : null}
                <path className="line" d={spark.path} />
                <circle className="dot" cx="300" cy={spark.lastY} r="2.6" />
              </>
            ) : null}
          </svg>

          <p className={`pit-hint ${hint.warn ? "warn" : ""}`}>{hint.text}</p>
          {connectError ? <p className="pit-hint warn">{connectError.message}</p> : null}
        </aside>

        <section className="pit-book">
          <header className="pit-book-head">
            <strong>The book</strong>
            <span>{live ? `${live.asset} ${fmtInterval(live.intervalSec)}` : ""}</span>
          </header>
          <ol className={`ladder ${live ? "" : "is-arming"}`}>
            {ladder.asks.map((l) => (
              <Row key={`a${l.price}`} side="ask" level={l} max={ladder.max} />
            ))}
            <li className="lad-mid">
              <span>{live ? `mid ${displayPlan.fair.toFixed(3)}` : "finding the next window"}</span>
              <i />
              {live ? (
                <span>{bothResting ? `your spread ${perSet.toFixed(3)}` : `next spread ${perSet.toFixed(3)}`}</span>
              ) : null}
            </li>
            {ladder.bids.map((l) => (
              <Row key={`b${l.price}`} side="bid" level={l} max={ladder.max} />
            ))}
          </ol>
          {chip ? (
            <div className="pit-chip" key={chip}>
              {chip}
            </div>
          ) : null}
        </section>

        <aside className="pit-house">
          <div className="pit-hold">
            <span className="pit-k">You hold</span>
            <strong className="pit-sets">
              <Num v={sets} dp={sets % 1 === 0 ? 0 : 2} />
              <em>complete set{sets === 1 ? "" : "s"}</em>
            </strong>
            <strong className="pit-kept">
              +<Num v={kept + sets * perSet} dp={3} />
              <em>spread kept</em>
            </strong>
            {unmatched > 0.0005 ? (
              <span className="pit-unmatched">
                {fmt(unmatched)} {unmatchedSide} unmatched. Flatten sells the leftover.
              </span>
            ) : null}
          </div>

          <div className="pit-act">
            <button type="button" className="solid" disabled={!canQuote} onClick={() => void run("quote")}>
              {busy === "quote" ? "Quoting…" : bothResting ? "Requote both sides" : "Quote both sides"}
            </button>
            <p className="pit-caption">{caption}</p>
            <div className="pit-tune">
              <label>
                Size
                <input type="text" inputMode="decimal" value={sizeText} onChange={(e) => setSizeText(e.target.value)} />
              </label>
              <label>
                Half spread
                <input type="text" inputMode="decimal" value={spreadText} onChange={(e) => setSpreadText(e.target.value)} />
              </label>
            </div>
            <div className="pit-more">
              <button type="button" className="ghost" disabled={!!busy || !live} onClick={() => void run("flatten")}>
                {busy === "flatten" ? "Flattening…" : "Flatten"}
              </button>
              <button type="button" className="ghost" disabled={!!busy} onClick={() => void run("redeem")}>
                {busy === "redeem" ? "Redeeming…" : "Redeem settled"}
              </button>
              <button type="button" className="text" disabled={!!busy || !live} onClick={() => void run("pull")}>
                {busy === "pull" ? "Pulling…" : "Pull quotes"}
              </button>
            </div>
          </div>

          <ol className="pit-log">
            {events.length === 0 ? (
              <li>
                <span>Quotes, fills and merges will show up here.</span>
              </li>
            ) : (
              events.map((e) => (
                <li key={e.id} className={e.tone ?? ""}>
                  <time>{stampShort(e.t / 1000)}</time>
                  <span>{e.text}</span>
                </li>
              ))
            )}
          </ol>
        </aside>
      </section>

      <footer className="pit-tape" aria-label="Recent fills">
        {fills.length === 0 ? (
          <span className="pit-tape-empty">No fills on this window yet.</span>
        ) : (
          fills.map((f) => {
            const mine =
              !!address && [f.maker, f.taker].some((a) => a && a.toLowerCase() === address.toLowerCase());
            const side = f.takerSide ?? (f.takerIsBid ? "BUY_YES" : "SELL_YES");
            const yes = side.endsWith("YES");
            return (
              <span className={`pit-tape-row ${mine ? "mine" : ""}`} key={f.id}>
                <i>{stampShort(Number(f.timestamp))}</i>
                <span className={yes ? "yes" : "no"}>{side.replace("_", " ").toLowerCase()}</span>
                <b>{fmt(toN(f.quantity))}</b>
                <span>at {toN(f.fillPrice).toFixed(3)}</span>
                {f.kind === "MINT_A_PAIR" ? <i>minted a set</i> : null}
                {mine ? <i className="you">you</i> : null}
              </span>
            );
          })
        )}
      </footer>
    </main>
  );
}

function Row({ side, level, max }: { side: "ask" | "bid"; level: Level; max: number }) {
  const cls = ["lad-row", side, level.mine ? "you" : "", level.ghost ? "ghost" : ""].filter(Boolean).join(" ");
  // Square root keeps a five lot quote visible next to a four hundred lot wall.
  const w = Math.max(0.06, Math.min(1, Math.sqrt(level.qty / max)));
  return (
    <li className={cls}>
      <span className="lad-px">{level.price.toFixed(3)}</span>
      <span className="lad-lane">
        <i className="lad-bar" style={{ ["--w" as string]: String(w) }} />
        {level.mine || level.ghost ? (
          <span className="lad-tag">
            <span>{level.ghost ? "Next" : "You"}</span> {side === "bid" ? "BUY_YES" : "BUY_NO"}
          </span>
        ) : null}
      </span>
      <span className="lad-qty">{fmt(level.qty)}</span>
    </li>
  );
}

// A number that eases to its new value instead of jumping.
function Num({ v, dp }: { v: number; dp: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cur = useRef(v);
  const text = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const o = { n: cur.current };
    const tween = gsap.to(o, {
      n: v,
      duration: reduce ? 0 : 0.7,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = text(o.n);
      },
    });
    cur.current = v;
    return () => {
      tween.kill();
    };
  }, [v, dp]);
  return <span ref={ref}>{text(v)}</span>;
}

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function stampShort(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Accepts a comma decimal too; falls back when the field is mid-edit or empty.
function parseNum(raw: string, fallback: number) {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtInterval(sec: number) {
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}
