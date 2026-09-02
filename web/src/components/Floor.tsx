"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Live write on Shannon, 2 Sep 2026: PostOnly BUY_YES 0.05 on BTC 15m, then cancel.
const TX = "0xe3e94725a488550c9a585d546a83f07914adb6ae0eef37e931c07969cad9938b";
const ORDER_ID = "147573952589676494756";
const WALLET = "0x857b7EfE554D39Ac226F556b982e074AB10995a6";
const VENUE = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const EXPLORER_TX = `https://shannon-explorer.somnia.network/tx/${TX}`;

const short = (s: string, head: number, tail: number) => `${s.slice(0, head)}…${s.slice(-tail)}`;

const ROWS = [
  {
    k: "Technical",
    w: 25,
    claim: "Real SDK writes, gated on chain state.",
    ev: "Windows come from listLiveBinaryMarkets. Every write checks the on-chain status first. PostOnly BUY_YES and BUY_NO carry a mandatory expiry, prices and sizes are snapped to tick and lot, cancel and replace, IOC flatten, redeem of Finalized markets. markets-sdk 0.29.0.",
  },
  {
    k: "Innovation",
    w: 20,
    claim: "The mint-a-pair path is the product, not a feature.",
    ev: "Two opposite buyers cross with no seller and the pool mints the set. Most entries take the book. HOUSE makes it, from a normal wallet, with zero inventory. Not ec-maker: nothing is minted up front and no YES is sold.",
  },
  {
    k: "UX",
    w: 20,
    claim: "One screen, one verb, honest risk.",
    ev: "Clock, BTC against the open, the book, your two quotes, inventory, Flatten and Redeem. Locked, empty and void windows are handled. Windows too close to lock are skipped, scaled to the interval.",
  },
  {
    k: "Ecosystem impact",
    w: 20,
    claim: "Depth where DreamDEX is thin.",
    ev: "Every HOUSE quote is two resting orders near mid. Fills mint complete sets, so open interest grows instead of changing hands. The Node quoter keeps quoting after the demo ends. Builder fees are the path to a business.",
  },
  {
    k: "Demo",
    w: 15,
    claim: "The loop is real on Shannon, not a slide.",
    ev: "Connect a Shannon wallet on the desk, quote both sides once per window, get hit, flatten, redeem. Two to three minutes: the problem, the mechanic, a live transaction, what comes next.",
  },
];

const RECEIPT: [string, string][] = [
  ["Chain", "Somnia Shannon 50312"],
  ["Venue", `DreamDEX ${short(VENUE, 6, 4)}`],
  ["Market", "BTC 15m, Trading"],
  ["Order", "PostOnly BUY_YES 0.05"],
  ["Order id", short(ORDER_ID, 5, 4)],
  ["Tx", short(TX, 8, 6)],
  ["Cancel", "success"],
  ["Grid", "tick 0.001, lot 0.001"],
  ["SDK", "markets-sdk 0.29.0"],
  ["Wallet", short(WALLET, 6, 4)],
];

export function Floor() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const once = (el: Element, fn: () => void) =>
          ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: fn });

        q<HTMLElement>(".score-row").forEach((row) => {
          const bar = row.querySelector<HTMLElement>(".score-bar s")!;
          const num = row.querySelector<HTMLElement>(".score-w b")!;
          const w = Number(num.dataset.w);
          const counter = { v: 0 };
          gsap.set(row, { x: -24, autoAlpha: 0 });
          gsap.set(bar, { scaleX: 0 });
          num.textContent = "0";
          once(row, () => {
            gsap.to(row, { x: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" });
            gsap.to(bar, { scaleX: 1, duration: 0.8, ease: "power2.out", delay: 0.15 });
            gsap.to(counter, {
              v: w,
              duration: 0.9,
              ease: "power2.out",
              delay: 0.15,
              onUpdate: () => {
                num.textContent = String(Math.round(counter.v));
              },
            });
          });
        });

        const print = q<HTMLElement>(".receipt-print")[0];
        const stamp = q<HTMLElement>(".receipt-stamp")[0];
        gsap.set(print, { clipPath: "inset(0% 0% 100% 0%)" });
        gsap.set(stamp, { xPercent: -50, scale: 1.8, rotation: -4, autoAlpha: 0 });
        once(print, () => {
          gsap.to(print, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power2.inOut" });
          gsap.to(stamp, {
            scale: 1,
            rotation: -12,
            autoAlpha: 0.9,
            duration: 0.35,
            ease: "power4.out",
            delay: 1.35,
          });
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="floor" id="judges">
      <div className="floor-head">
        <p className="land-kicker">For the floor</p>
        <h2>Five criteria. One receipt.</h2>
        <p className="floor-lede">
          Scored the way the hackathon scores it, with the proof printed beside it.
        </p>
      </div>

      <div className="floor-grid">
        <ol className="score">
          {ROWS.map((r) => (
            <li className="score-row" key={r.k}>
              <div className="score-meta">
                <span className="score-k">{r.k}</span>
                <span className="score-w">
                  <b data-w={r.w}>{r.w}</b>%
                </span>
                <i className="score-bar" style={{ "--w": r.w / 25 } as CSSProperties}>
                  <s />
                </i>
              </div>
              <div className="score-body">
                <h3>{r.claim}</h3>
                <p>{r.ev}</p>
              </div>
            </li>
          ))}
        </ol>

        <aside className="receipt">
          <div className="receipt-print">
            <div className="receipt-paper">
              <header>
                <strong>HOUSE</strong>
                <span>Somnia Shannon</span>
                <span>Live write, 02 Sep 2026</span>
              </header>
              <dl>
                {RECEIPT.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <i className="lead" />
                    <dd>
                      {k === "Tx" ? (
                        <a href={EXPLORER_TX} target="_blank" rel="noreferrer">
                          {v}
                        </a>
                      ) : (
                        v
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="receipt-bar" aria-hidden="true" />
              <footer>
                <a href="https://github.com/wildanrhmn/house" target="_blank" rel="noreferrer">
                  github.com/wildanrhmn/house
                </a>
                <span>Somnia x DreamDEX Event Contracts</span>
                <span>Submit by 8 Sep 2026</span>
              </footer>
              <div className="receipt-stamp" aria-hidden="true">
                Proven on Shannon
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
