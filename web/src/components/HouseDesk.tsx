"use client";

import { toHuman } from "@somnia-chain/markets-sdk";
import {
  useLiveBinaryOrderBookByMarket,
  useLivePrice,
  useWatchMarket,
  useWatchPrice,
} from "@somnia-chain/markets-sdk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { ClockRing } from "./ClockRing";
import { QuoteBeam } from "./QuoteBeam";
import { DEFAULT_HALF_SPREAD, DEFAULT_QUOTE_SIZE, minLeftSec } from "@/lib/config";
import { discoverWindow, openingPrice, type HouseWindow } from "@/lib/discover";
import { createSignedExchange, getReadExchange } from "@/lib/exchange";
import {
  cancelOwn,
  flattenInventory,
  planQuotes,
  quoteBothSides,
  readInventory,
  redeemSettled,
  type QuotePlan,
} from "@/lib/house";
import { fairYes } from "@/lib/quoting";

export function HouseDesk() {
  const [live, setLive] = useState<HouseWindow | null>(null);
  const [openPx, setOpenPx] = useState<number | null>(null);
  const [plan, setPlan] = useState<QuotePlan | null>(null);
  const [inv, setInv] = useState({ up: 0, down: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [size, setSize] = useState(DEFAULT_QUOTE_SIZE);
  const [spread, setSpread] = useState(DEFAULT_HALF_SPREAD);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  useWatchPrice(live?.asset);
  useWatchMarket(live?.pool);
  const livePx = useLivePrice(live?.asset);
  const liveBook = useLiveBinaryOrderBookByMarket(live?.marketId, 6);
  const book = liveBook ?? { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };

  const remaining = live ? live.expiry - now : 0;

  const yesBid = book.yesBids[0]
    ? Number(toHuman(book.yesBids[0].price, live?.quoteDecimals ?? 6))
    : undefined;
  const yesAsk = book.yesAsks[0]
    ? Number(toHuman(book.yesAsks[0].price, live?.quoteDecimals ?? 6))
    : undefined;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(id);
  }, []);

  const refreshWindow = useCallback(async () => {
    try {
      const exchange = getReadExchange();
      const next = await discoverWindow(exchange);
      setLive(next);
      if (next) {
        const open = await openingPrice(exchange, next.marketId);
        setOpenPx(open);
        const p = await planQuotes(exchange, next, spread, size);
        setPlan(p);
      } else {
        setOpenPx(null);
        setPlan(null);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  }, [size, spread]);

  useEffect(() => {
    void refreshWindow();
    const id = setInterval(() => void refreshWindow(), 12_000);
    return () => clearInterval(id);
  }, [refreshWindow]);

  const refreshInv = useCallback(async () => {
    if (!live || !walletClient || !address) {
      setInv({ up: 0, down: 0 });
      return;
    }
    const signed = createSignedExchange({ walletClient });
    const raw = await readInventory(signed, live);
    const d = live.quoteDecimals;
    setInv({ up: Number(toHuman(raw.up, d)), down: Number(toHuman(raw.down, d)) });
  }, [live, walletClient, address]);

  useEffect(() => {
    void refreshInv();
  }, [refreshInv]);

  const run = async (label: "quote" | "flatten" | "redeem") => {
    if (!walletClient) {
      setNote("Connect a wallet first.");
      return;
    }
    if (!live && label !== "redeem") {
      setNote("No live DreamDEX window yet.");
      return;
    }
    setBusy(label);
    setNote(null);
    try {
      const signed = createSignedExchange({ walletClient });
      let text = "";
      if (label === "quote") {
        if (!live) return;
        const p = (await planQuotes(signed, live, spread, size)) ?? plan;
        if (!p) {
          setNote("Window is too close to lock, or the book has no fair.");
          return;
        }
        await cancelOwn(signed, live);
        const result = await quoteBothSides(signed, live, { ...p, size });
        const bits = [
          result.upId ? `Up #${result.upId}` : null,
          result.downId ? `Down #${result.downId}` : null,
          result.skipped.length ? result.skipped.join(". ") : null,
        ].filter(Boolean);
        text = bits.join(". ") || "Quoted.";
      } else if (label === "flatten") {
        if (!live) return;
        await flattenInventory(signed, live);
        text = "Flattened.";
      } else {
        const n = await redeemSettled(signed);
        text = n === 0 ? "Nothing to redeem." : `Redeemed ${n} payout${n === 1 ? "" : "s"}.`;
      }
      setNote(text);
      await refreshInv();
      await refreshWindow();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const btc = livePx?.price ?? null;
  const vsOpen =
    btc != null && openPx != null && openPx !== 0 ? ((btc - openPx) / openPx) * 100 : null;

  const displayPlan = useMemo(() => {
    if (plan) return plan;
    const fair = fairYes(yesBid, yesAsk);
    return { bidYes: fair - spread, askYes: fair + spread, size, fair };
  }, [plan, yesBid, yesAsk, spread, size]);

  return (
    <main className="pit">
      <header className="mast">
        <p className="wordmark">HOUSE</p>
        <p className="lede">Be the book. Quote both sides. Keep the spread.</p>
        <div className="wallet">
          {isConnected && address ? (
            <>
              <span className="addr">{short(address)}</span>
              <button type="button" className="ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
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

      {!live ? (
        <p className="banner">Waiting for a live DreamDEX BTC 15m window.</p>
      ) : remaining <= 0 ? (
        <p className="banner">This window locked. The next one will arm automatically.</p>
      ) : null}

      {connectError ? <p className="banner warn">{connectError.message}</p> : null}

      <section className="stage">
        <ClockRing remaining={remaining} duration={live?.intervalSec ?? 900} />
        <div className="stats">
          <Stat k="Asset" v={live ? `${live.asset} ${fmtInterval(live.intervalSec)}` : "-"} />
          <Stat k="BTC now" v={btc == null ? "-" : btc.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Stat k="Open" v={openPx == null ? "-" : openPx.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Stat k="Vs open" v={vsOpen == null ? "-" : `${vsOpen >= 0 ? "+" : ""}${vsOpen.toFixed(3)}%`} />
        </div>
      </section>

      <QuoteBeam
        up={inv.up}
        down={inv.down}
        bidYes={displayPlan.bidYes}
        askYes={displayPlan.askYes}
      />

      <section className="tape">
        <BookCol title="Up bids" rows={book.yesBids} decimals={live?.quoteDecimals ?? 6} />
        <BookCol title="Up asks" rows={book.yesAsks} decimals={live?.quoteDecimals ?? 6} ask />
      </section>

      <section className="desk">
        <label>
          Size
          <input
            type="number"
            min={0.001}
            step={1}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
        <label>
          Half spread
          <input
            type="number"
            min={0.001}
            max={0.2}
            step={0.001}
            value={spread}
            onChange={(e) => setSpread(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="solid"
          disabled={!!busy || !live || remaining <= minLeftSec(live.intervalSec)}
          onClick={() => void run("quote")}
        >
          {busy === "quote" ? "Quoting..." : "Quote both sides"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!!busy || !live}
          onClick={() => void run("flatten")}
        >
          {busy === "flatten" ? "Flattening..." : "Flatten"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!!busy}
          onClick={() => void run("redeem")}
        >
          {busy === "redeem" ? "Redeeming..." : "Redeem settled"}
        </button>
      </section>

      {note ? <p className="note">{note}</p> : null}
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <span>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

function BookCol({
  title,
  rows,
  decimals,
  ask,
}: {
  title: string;
  rows: Array<{ price: bigint | string; quantity: bigint | string }>;
  decimals: number;
  ask?: boolean;
}) {
  return (
    <div className={ask ? "col ask" : "col bid"}>
      <h2>{title}</h2>
      <ol>
        {(rows ?? []).slice(0, 6).map((row, i) => (
          <li key={i}>
            <span>{Number(toHuman(row.price, decimals)).toFixed(3)}</span>
            <span>{Number(toHuman(row.quantity, decimals)).toFixed(2)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtInterval(sec: number) {
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}
