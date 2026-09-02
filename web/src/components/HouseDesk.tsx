"use client";

import { toHuman, type BinaryOrderBook } from "@somnia-chain/markets-sdk";
import { useLivePrice, useWatchPrice } from "@somnia-chain/markets-sdk/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { HouseLogo } from "./HouseLogo";
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
import { DEFAULT_MARKET, MARKET_ASSETS, MARKETS, intervalWords, marketFromKey, type Market } from "@/lib/config";
import { discoverWindow, openingPrice, type HouseWindow } from "@/lib/discover";
import { createSignedExchange, getReadExchange } from "@/lib/exchange";
import {
  cancelOwn,
  flattenInventory,
  quoteWithRetry,
  redeemSettled,
  restingQuotes,
  type Resting,
} from "@/lib/house";
import { clampProb, fairYes } from "@/lib/quoting";

gsap.registerPlugin(useGSAP);

type Tone = "up" | "down" | "warn";
type Ev = { id: number; t: number; text: string; tone?: Tone };

const pc = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });
const EMPTY_BOOK: BinaryOrderBook = { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };

export function HouseDesk() {
  const root = useRef<HTMLElement>(null);
  const [live, setLive] = useState<HouseWindow | null>(null);
  const [openPx, setOpenPx] = useState<number | null>(null);
  const [market, setMarket] = useState<Market>(DEFAULT_MARKET);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inv, setInv] = useState({ up: 0, down: 0 });
  const [book, setBook] = useState<BinaryOrderBook>(EMPTY_BOOK);
  const [series, setSeries] = useState<Array<{ t: number; p: number }>>([]);
  const [resting, setResting] = useState<Resting[]>([]);
  const [collateral, setCollateral] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [kept, setKept] = useState(0);
  const [chip, setChip] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [sizeText, setSizeText] = useState(String(DEFAULT_QUOTE_SIZE));
  const [cutText, setCutText] = useState(String(DEFAULT_HALF_SPREAD * 2));
  const size = parseNum(sizeText, DEFAULT_QUOTE_SIZE);
  const spread = parseNum(cutText, DEFAULT_HALF_SPREAD * 2) / 2;
  const evId = useRef(0);
  const lastSets = useRef(-1);
  const lastMarket = useRef<string | null>(null);
  const prevInv = useRef<{ up: number; down: number } | null>(null);
  const prevResting = useRef<Resting[]>([]);

  const { address: connected, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  // /desk?watch=0x... follows a wallet read-only, for a judge or a demo that
  // watches the Node quoter. Actions still need a connected wallet.
  const [watch, setWatch] = useState<Address | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("watch");
    if (w && /^0x[0-9a-fA-F]{40}$/.test(w)) setWatch(w as Address);
    if (params.get("m")) setMarket(marketFromKey(params.get("m")));
  }, []);
  const address = connected ?? watch;

  useWatchPrice(live?.asset);
  const livePx = useLivePrice(live?.asset);

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

  const secondsLeft = Math.max(0, Math.floor(remaining));
  useEffect(() => {
    if (!live) {
      document.title = "Desk, HOUSE";
      return;
    }
    const left = phase === "locked" ? "locked" : clock(secondsLeft);
    const mine = resting.length >= 2 ? "resting, " : "";
    document.title = `${mine}${left} ${live.asset} ${fmtInterval(live.intervalSec)}, HOUSE`;
  }, [live, secondsLeft, phase, resting.length]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".pit-top", { autoAlpha: 0, y: -8, duration: 0.6, ease: "power2.out" });
        gsap.from(".pit-stage > *", {
          autoAlpha: 0,
          y: 18,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          delay: 0.15,
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const refreshWindow = useCallback(async () => {
    try {
      const exchange = getReadExchange();
      const next = await discoverWindow(exchange, market.asset, market.intervalSec);
      setLive(next);
      if (next) {
        if (lastMarket.current && lastMarket.current !== next.marketId) {
          log(`A new ${next.asset} ${fmtInterval(next.intervalSec)} window opened.`);
        }
        lastMarket.current = next.marketId;
        const open = await openingPrice(exchange, next.marketId);
        setOpenPx(open);
      } else {
        setOpenPx(null);
      }
    } catch (err) {
      log(err instanceof Error ? err.message : String(err), "warn");
    }
  }, [log, market]);

  useEffect(() => {
    void refreshWindow();
    const id = setInterval(() => void refreshWindow(), 12_000);
    return () => clearInterval(id);
  }, [refreshWindow]);

  const selectMarket = useCallback(
    (m: Market) => {
      setMenuOpen(false);
      if (m.key === market.key) return;
      setLive(null);
      setOpenPx(null);
      lastMarket.current = null;
      setMarket(m);
      const url = new URL(window.location.href);
      if (m.key === DEFAULT_MARKET.key) url.searchParams.delete("m");
      else url.searchParams.set("m", m.key);
      window.history.replaceState(null, "", url);
      log(`Switched to ${m.asset}, ${intervalWords(m.intervalSec)}.`);
    },
    [log, market.key],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".pit-mkt")) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  // The book comes from the chain every two seconds. The indexer and the
  // websocket tail can run minutes behind; the pool never does.
  useEffect(() => {
    if (!live) {
      setBook(EMPTY_BOOK);
      return;
    }
    let stop = false;
    const pool = live.pool as Address;
    const dec = live.quoteDecimals;
    const read = async () => {
      try {
        const b = await getReadExchange().client.getBinaryOrderBook(pool, { depth: 3, decimals: dec });
        if (!stop) setBook(b);
      } catch {
      }
    };
    void read();
    const id = setInterval(() => void read(), 2_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [live]);

  // The price line is sampled from the live index as it arrives, so it never
  // depends on indexed history. It keeps the current window only.
  useEffect(() => {
    const p = livePx?.price;
    if (!p || !live) return;
    const t = Date.now() / 1000;
    const from = live.expiry - live.intervalSec;
    setSeries((s) => {
      const last = s[s.length - 1];
      if (last && Math.abs(last.p - p) < 1e-9 && t - last.t < 2) return s;
      return [...s.filter((x) => x.t >= from), { t, p }].slice(-240);
    });
  }, [livePx, live, now]);

  const refreshMine = useCallback(async () => {
    if (!live || !address) {
      setInv({ up: 0, down: 0 });
      setResting([]);
      setCollateral(null);
      lastSets.current = -1;
      prevInv.current = null;
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
      const prev = prevInv.current;
      if (prev) {
        const wasBid = prevResting.current.find((o) => o.isBid);
        const wasAsk = prevResting.current.find((o) => !o.isBid);
        if (u > prev.up + 1e-9) {
          log(`Someone took your UP price${wasBid ? ` at ${toN(wasBid.price).toFixed(3)}` : ""}. You hold ${fmt(u - prev.up)} more UP.`, "up");
        }
        if (dn > prev.down + 1e-9) {
          log(`Someone took your DOWN price${wasAsk ? ` at ${(1 - toN(wasAsk.price)).toFixed(3)}` : ""}. You hold ${fmt(dn - prev.down)} more DOWN.`, "down");
        }
      }
      prevInv.current = { up: u, down: dn };
      prevResting.current = r.orders;
      setInv({ up: u, down: dn });
      setResting(r.orders);
      setCollateral(Number(toHuman(bal, 6)));
      const sets = Math.min(u, dn);
      if (lastSets.current >= 0 && sets > lastSets.current) {
        const n = sets - lastSets.current;
        setChip("Both sides taken. A pair is yours.");
        log(`${fmt(n)} pair${n === 1 ? "" : "s"} complete. Cash out to bank 1.00 each.`, "up");
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
    const id = setTimeout(() => setChip(null), 3_000);
    return () => clearTimeout(id);
  }, [chip]);

  const yesBid = book.yesBids[0] ? toN(book.yesBids[0].price) : undefined;
  const yesAsk = book.yesAsks[0] ? toN(book.yesAsks[0].price) : undefined;
  const mineBid = resting.find((o) => o.isBid);
  const mineAsk = resting.find((o) => !o.isBid);
  const bothResting = !!mineBid && !!mineAsk;

  // Where the next quote would sit, from the live book: one tick inside a
  // wider market, never thinner than two ticks, never wider than the cut.
  const next = useMemo(() => {
    const tick = 0.001;
    const fair = fairYes(yesBid, yesAsk);
    let half = spread;
    if (yesBid !== undefined && yesAsk !== undefined) {
      half = Math.max(2 * tick, Math.min(spread, (yesAsk - yesBid) / 2 - tick));
    }
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    return { bid: r3(clampProb(fair - half)), ask: r3(clampProb(fair + half)), fair };
  }, [yesBid, yesAsk, spread]);

  // Everything the user sees is in "what you pay" terms. UP is the YES price.
  // DOWN is one minus the YES price of the BUY_NO order.
  const upPay = mineBid ? toN(mineBid.price) : next.bid;
  const downPay = mineAsk ? 1 - toN(mineAsk.price) : 1 - next.ask;
  const pairCost = upPay + downPay;
  const perPair = Math.max(0, 1 - pairCost);
  const sets = Math.min(inv.up, inv.down);
  const unmatched = Math.abs(inv.up - inv.down);
  const unmatchedSide = inv.up > inv.down ? "UP" : "DOWN";
  const crowdUp = yesBid;
  const crowdDown = yesAsk !== undefined ? 1 - yesAsk : undefined;

  const spark = useMemo(() => {
    const pts = series.map((x) => x.p);
    if (pts.length < 2) return null;
    const all = openPx != null ? [...pts, openPx] : pts;
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    const pad = Math.max((hi - lo) * 0.2, hi * 0.0002);
    lo -= pad;
    hi += pad;
    const x = (i: number) => (i / (pts.length - 1)) * 300;
    const y = (p: number) => 90 - ((p - lo) / (hi - lo)) * 90;
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
    return { path, openY: openPx != null ? y(openPx) : null, lastY: y(pts[pts.length - 1]) };
  }, [series, openPx]);

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
          log(
            `Your prices are up: ${result.plan.bidYes.toFixed(3)} for UP, ${(1 - result.plan.askYes).toFixed(3)} for DOWN. Waiting for takers.`,
            "up",
          );
        } else {
          log(`Only one side posted. ${result.skipped.join(". ")}.`, "warn");
        }
      } else if (label === "flatten" && live) {
        const out = await flattenInventory(signed, live);
        const merged = toN(out.merged);
        const sold = toN(out.soldUp + out.soldDown);
        if (merged > 0) setKept((k) => k + merged * perPair);
        const parts = [
          merged > 0 ? `Banked ${fmt(merged)} pair${merged === 1 ? "" : "s"} for ${merged.toFixed(2)} tUSDC` : null,
          sold > 0 ? `sold ${fmt(sold)} unmatched at the market` : null,
        ].filter(Boolean);
        log(parts.length ? `${parts.join(", ")}.` : "Nothing to cash out.", merged > 0 ? "up" : undefined);
        lastSets.current = 0;
        prevInv.current = null;
      } else if (label === "pull" && live) {
        const n = await cancelOwn(signed, live);
        log(n ? `Took down ${n} price${n === 1 ? "" : "s"}.` : "No prices to take down.");
      } else if (label === "redeem") {
        const n = await redeemSettled(signed);
        log(n === 0 ? "Nothing to collect yet." : `Collected ${n} payout${n === 1 ? "" : "s"}.`, n ? "up" : undefined);
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
  const crowdPct = Math.round(next.fair * 100);

  const hint = !live
    ? { text: "Finding the next window.", warn: false }
    : phase === "locked"
      ? { text: "Locked. The next window opens on its own.", warn: true }
      : phase === "locking"
        ? { text: `Locks in ${Math.ceil(remaining)}s. Posting is closed.`, warn: true }
        : !isConnected && watch
          ? { text: `Following ${short(watch)}.`, warn: false }
          : !isConnected
            ? { text: "Connect a wallet to post your prices.", warn: false }
            : bothResting
              ? { text: "Both prices are up. Takers pay you the gap.", warn: false }
              : { text: "Crowd near " + crowdPct + "% yes. You price both sides.", warn: false };

  const sideState = (mine: Resting | undefined, held: number) => {
    if (mine) return { cls: "waiting", text: "Waiting for a taker" };
    if (held > 0) return { cls: "taken", text: "Taken" };
    if (!live || phase !== "trading") return { cls: "off", text: "Closed" };
    return { cls: "next", text: isConnected ? "Not posted yet" : "Preview" };
  };
  const upState = sideState(mineBid, inv.up);
  const downState = sideState(mineAsk, inv.down);

  return (
    <main ref={root} className="pit">
      <div className="pit-glow" aria-hidden="true" />
      <div className="pit-grain" aria-hidden="true" />

      <header className="pit-top">
        <Link className="pit-mark" href="/">
          <HouseLogo size={18} />
        </Link>
        <div className={`pit-mkt${menuOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="pit-mkt-btn"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {market.asset} <span>{intervalWords(market.intervalSec)}</span>
          </button>
          {menuOpen ? (
            <div className="pit-menu" role="listbox">
              {MARKET_ASSETS.map((asset) => (
                <div className="pit-menu-col" key={asset}>
                  <span className="pit-k">{asset}</span>
                  {MARKETS.filter((m) => m.asset === asset).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="option"
                      aria-selected={m.key === market.key}
                      className={m.key === market.key ? "is-on" : ""}
                      onClick={() => selectMarket(m)}
                    >
                      {intervalWords(m.intervalSec)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
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
        <div className="row-window">
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

          <div className="pit-index">
            <div className="pit-px">
              <span className="pit-k">{live ? `${live.asset} now` : "Index"}</span>
              <strong>{btc == null ? "–" : btc.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
              <span className={`pit-delta ${upside ? "up" : "down"}`}>
                {vsOpen == null
                  ? "waiting for the open"
                  : `${vsOpen >= 0 ? "+" : ""}${vsOpen.toFixed(3)}% from the open`}
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
          </div>
        </div>

        <div className="row-q">
          <h2>
            {live && openPx != null
              ? `Will ${live.asset} be above ${openPx.toLocaleString("en-US", { maximumFractionDigits: 0 })} at ${stampShort(live.expiry)}?`
              : "Waiting for the next window"}
          </h2>
          <p className={`pit-hint ${hint.warn ? "warn" : ""}`}>{hint.text}</p>
          {connectError ? <p className="pit-hint warn">{connectError.message}</p> : null}
        </div>

        <div className="row-sides">
          <article className="side up">
            <header>
              <span className="side-name">Up</span>
              <span className={`pill ${upState.cls}`}>{upState.text}</span>
            </header>
            <strong>{upPay.toFixed(3)}</strong>
            <span className="side-you">you pay</span>
            <span className="side-crowd">{crowdUp !== undefined ? `crowd ${crowdUp.toFixed(3)}` : "no bids yet"}</span>
            {inv.up > 0 ? <span className="side-held">holding {fmt(inv.up)}</span> : null}
          </article>
          <article className="side down">
            <header>
              <span className="side-name">Down</span>
              <span className={`pill ${downState.cls}`}>{downState.text}</span>
            </header>
            <strong>{downPay.toFixed(3)}</strong>
            <span className="side-you">you pay</span>
            <span className="side-crowd">{crowdDown !== undefined ? `crowd ${crowdDown.toFixed(3)}` : "no bids yet"}</span>
            {inv.down > 0 ? <span className="side-held">holding {fmt(inv.down)}</span> : null}
          </article>
          {chip ? (
            <div className="pit-chip" key={chip}>
              {chip}
            </div>
          ) : null}
        </div>

        <div className="row-sum">
          <div>
            <b>{pairCost.toFixed(3)}</b>
            <i>a pair costs you</i>
          </div>
          <div>
            <b>1.000</b>
            <i>a pair pays</i>
          </div>
          <div className="keep">
            <b>+{perPair.toFixed(3)}</b>
            <i>you keep</i>
          </div>
        </div>

        <div className="row-act">
          <button type="button" className="solid" disabled={!canQuote} onClick={() => void run("quote")}>
            {busy === "quote" ? "Posting…" : bothResting ? "Repost both sides" : "Quote both sides"}
          </button>
          <div className="pit-tune">
            <label>
              <input type="text" inputMode="decimal" value={sizeText} onChange={(e) => setSizeText(e.target.value)} />
              <span>a side</span>
            </label>
            <label>
              <input type="text" inputMode="decimal" value={cutText} onChange={(e) => setCutText(e.target.value)} />
              <span>cut, max</span>
            </label>
          </div>
          <div className="acts">
            <button
              type="button"
              className="ghost"
              disabled={!!busy || !live}
              title="Hands pairs back for 1.00 each and sells anything unmatched"
              onClick={() => void run("flatten")}
            >
              {busy === "flatten" ? "Cashing out…" : "Cash out"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy}
              title="Collects winnings from windows that already settled"
              onClick={() => void run("redeem")}
            >
              {busy === "redeem" ? "Collecting…" : "Collect payouts"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy || !live}
              title="Cancels your resting prices"
              onClick={() => void run("pull")}
            >
              {busy === "pull" ? "Taking down…" : "Take down"}
            </button>
          </div>
        </div>

        <div className="row-ledger">
          <div>
            <b>
              <Num v={sets} dp={sets % 1 === 0 ? 0 : 2} />
            </b>
            <i>pairs held</i>
          </div>
          <div>
            <b>{unmatched > 0.0005 ? `${fmt(unmatched)} ${unmatchedSide}` : "0"}</b>
            <i>unmatched</i>
          </div>
          <div className="keep">
            <b>
              +<Num v={kept + sets * perPair} dp={3} />
            </b>
            <i>spread kept</i>
          </div>
        </div>

        <ol className="pit-log">
          {events.length === 0 ? (
            <li>
              <span>Your prices, fills and pairs will show up here.</span>
            </li>
          ) : (
            events.slice(0, 4).map((e) => (
              <li key={e.id} className={e.tone ?? ""}>
                <time>{stampShort(e.t / 1000)}</time>
                <span>{e.text}</span>
              </li>
            ))
          )}
        </ol>
      </section>
    </main>
  );
}

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
  const mmss = `${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mmss}` : mmss;
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
  if (sec % 86400 === 0) return `${sec / 86400}d`;
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}
