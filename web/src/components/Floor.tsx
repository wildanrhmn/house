"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// One full HOUSE loop on Shannon, 2 Sep 2026, market 0x...11199 (BTC 15m).
const TX_LIFT = "0x76f7625ce7fa6c1264fbbe752d1d2a6a5a064cc871706eb56028fa63c2bb77a2";
const TX_HIT = "0xcb589ed80a98999a8a82e51f102475df97d8e5731f71df8d1e8d51f87e1888db";
const TX_MERGE = "0xed699ecef467211225f8c333588ac16aef09424809b080bd62665b018c97c4a1";
const TX_BOT = "0x14295dd86137d448411d864635743a59796df5f284e595879f70109268941af0";
const MAKER = "0x857b7EfE554D39Ac226F556b982e074AB10995a6";
const TAKER = "0x3f0fd9FeF2673AEFd622c8B797c1BD3D0AB784eC";
const VENUE = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const EXPLORER = "https://shannon-explorer.somnia.network/tx/";

const short = (s: string, head: number, tail: number) => `${s.slice(0, head)}…${s.slice(-tail)}`;

const ROWS = [
  {
    k: "Technical",
    w: 25,
    claim: "Real SDK writes, gated on chain state.",
    ev: "Windows come from listLiveBinaryMarkets. Every write checks the on-chain status first. PostOnly BUY_YES and BUY_NO carry a mandatory expiry, prices and sizes are snapped to tick and lot, cancel and replace read open orders at chain head, IOC flatten, burnSet merge, redeem of Finalized markets. markets-sdk 0.29.0.",
  },
  {
    k: "Innovation",
    w: 20,
    claim: "The mint-a-pair path is the product, not a feature.",
    ev: "Two opposite buyers cross with no seller and the pool mints the set. Most entries take the book. HOUSE makes it, from a normal wallet, with zero inventory, and merges the pair back to collateral to bank the spread. Not ec-maker: nothing is minted up front and no YES is sold.",
  },
  {
    k: "UX",
    w: 20,
    claim: "One screen, one verb, honest risk.",
    ev: "Clock, BTC against the open, the book, your two quotes, sets held, spread kept, Flatten and Redeem. Locked, empty and void windows are handled. The last fifth of a window is never quoted into.",
  },
  {
    k: "Ecosystem impact",
    w: 20,
    claim: "Depth where DreamDEX is thin.",
    ev: "Every HOUSE quote is two resting orders one tick inside the market. Fills mint complete sets, so open interest grows instead of changing hands. A third-party bot already lifted a HOUSE quote on its own. The Node quoter keeps quoting after the demo ends. Builder fees are the path to a business.",
  },
  {
    k: "Demo",
    w: 15,
    claim: "The loop ran on Shannon. The receipt is on the right.",
    ev: "One command rested both sides, a second wallet crossed both, five complete sets landed in HOUSE, the merge returned collateral, and the spread came out to the cent. Then the same loop on the desk with a browser wallet, two to three minutes.",
  },
];

type Line = [string, string, string?];

const RECEIPT: Line[] = [
  ["Chain", "Somnia Shannon 50312"],
  ["Venue", `DreamDEX ${short(VENUE, 6, 4)}`],
  ["Market", "BTC 15m, id …11199"],
  ["Rest", "BUY_YES 0.036, Up ask 0.055"],
  ["Size", "5 contracts a side"],
  ["Lift ask", short(TX_LIFT, 8, 6), TX_LIFT],
  ["Hit bid", short(TX_HIT, 8, 6), TX_HIT],
  ["Minted", "5 complete sets to HOUSE"],
  ["Merge", short(TX_MERGE, 8, 6), TX_MERGE],
  ["Spread kept", "+0.095 tUSDC, 5 x 0.019"],
  ["Bot fill", short(TX_BOT, 8, 6), TX_BOT],
  ["Maker", short(MAKER, 6, 4)],
  ["Taker", short(TAKER, 6, 4)],
  ["SDK", "markets-sdk 0.29.0"],
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
                <span>Live loop, 02 Sep 2026</span>
              </header>
              <dl>
                {RECEIPT.map(([k, v, href]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <i className="lead" />
                    <dd>
                      {href ? (
                        <a href={`${EXPLORER}${href}`} target="_blank" rel="noreferrer">
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
