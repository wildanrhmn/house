"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const ASKS: [number, number][] = [
  [0.56, 0.22],
  [0.54, 0.4],
];
const BIDS: [number, number][] = [
  [0.46, 0.4],
  [0.44, 0.22],
];
const YOU_W = 0.68;

function Row({
  side,
  px,
  w,
  you,
  order,
}: {
  side: "ask" | "bid";
  px: number;
  w: number;
  you?: boolean;
  order?: string;
}) {
  return (
    <li className={`book-row ${side}${you ? " you" : ""}`} style={{ "--w": w } as CSSProperties}>
      <span className="px">{px.toFixed(2)}</span>
      <span className="lane">
        <i className="bar" />
        {you ? (
          <>
            <b className="who">
              <span>You</span> {order}
            </b>
            <i className="taker" />
            <em className="fill">Filled</em>
          </>
        ) : null}
      </span>
    </li>
  );
}

export function HeroBook() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const clock = q<HTMLElement>(".book-clock")[0];
        const kept = q<HTMLElement>(".book-kept")[0];
        const sets = q<HTMLElement>(".book-sets")[0];
        let minted = 0;
        const showCount = () => {
          sets.textContent = String(minted);
          kept.textContent = `+${(minted * 0.04).toFixed(2)}`;
        };

        // The window clock rolls every 15 minutes and a fresh window starts
        // the counters again.
        let secs = 14 * 60 + 59 - Math.floor(Math.random() * 240);
        const tick = () => {
          if (secs <= 0) {
            secs = 899;
            minted = 0;
            showCount();
          } else {
            secs -= 1;
          }
          clock.textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
        };
        tick();
        const timer = window.setInterval(tick, 1000);

        const ask = q<HTMLElement>(".book-row.you.ask")[0];
        const bid = q<HTMLElement>(".book-row.you.bid")[0];
        const set = q<HTMLElement>(".book-set")[0];
        const midLabels = q<HTMLElement>(".book-mid > span");
        const fills = [ask, bid].map((r) => r.querySelector<HTMLElement>(".fill")!);
        const bars = [ask, bid].map((r) => r.querySelector<HTMLElement>(".bar")!);
        gsap.set(fills[0], { xPercent: -100, yPercent: -50, scale: 0.6, autoAlpha: 0 });
        gsap.set(fills[1], { xPercent: 100, yPercent: -50, scale: 0.6, autoAlpha: 0 });
        gsap.set(set, { xPercent: -50, yPercent: -50, scale: 0.8, autoAlpha: 0 });

        // A taker walks in from the empty side of the book, hits the resting
        // quote, the bar drains and a fill chip pops at the tip.
        const hit = (tl: gsap.core.Timeline, row: HTMLElement, at: number) => {
          const taker = row.querySelector<HTMLElement>(".taker")!;
          const bar = row.querySelector<HTMLElement>(".bar")!;
          const fill = row.querySelector<HTMLElement>(".fill")!;
          const edge = row.classList.contains("ask") ? "left" : "right";
          tl.fromTo(taker, { [edge]: "0%", autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, at)
            .to(taker, { [edge]: `${(1 - YOU_W) * 100}%`, duration: 0.9, ease: "power2.in" }, at)
            .to(taker, { autoAlpha: 0, duration: 0.15 }, at + 0.9)
            .fromTo(bar, { filter: "brightness(1)" }, { filter: "brightness(2.2)", duration: 0.12, yoyo: true, repeat: 1 }, at + 0.85)
            .to(bar, { scaleX: 0, duration: 0.4, ease: "power3.in" }, at + 0.95)
            .to(fill, { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(2)" }, at + 1.0);
        };

        const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.8, delay: 3.4 });
        hit(loop, ask, 0);
        hit(loop, bid, 1.5);
        loop
          .to(midLabels, { autoAlpha: 0.15, duration: 0.25 }, 3.0)
          .to(
            set,
            {
              scale: 1,
              autoAlpha: 1,
              duration: 0.35,
              ease: "back.out(2)",
              onStart: () => {
                minted += 1;
                showCount();
              },
            },
            3.1,
          )
          .to(set, { autoAlpha: 0, y: -8, duration: 0.3 }, 4.6)
          .to(midLabels, { autoAlpha: 1, duration: 0.3 }, 4.7)
          .set(set, { y: 0 })
          .to(fills, { scale: 0.6, autoAlpha: 0, duration: 0.25 }, 4.7)
          .to(bars, { scaleX: 1, duration: 0.6, ease: "power2.out", stagger: 0.1 }, 4.9);

        return () => window.clearInterval(timer);
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="book" aria-hidden="true">
      <header className="book-head">
        <span className="book-mkt">BTC 15m</span>
        <span className="book-live">
          <i />
          Trading
        </span>
        <span className="book-clock">14:59</span>
      </header>
      <ol className="book-rows">
        {ASKS.map(([px, w]) => (
          <Row key={px} side="ask" px={px} w={w} />
        ))}
        <Row side="ask" px={0.52} w={YOU_W} you order="BUY_NO" />
        <li className="book-mid">
          <span>mid 0.50</span>
          <span className="book-spread">spread 0.04, yours</span>
          <div className="book-set">
            <i className="coin" />
            Set minted, +0.04
          </div>
        </li>
        <Row side="bid" px={0.48} w={YOU_W} you order="BUY_YES" />
        {BIDS.map(([px, w]) => (
          <Row key={px} side="bid" px={px} w={w} />
        ))}
      </ol>
      <footer className="book-foot">
        <span>
          Start inventory
          <strong>0</strong>
        </span>
        <span>
          Sets minted
          <strong className="book-sets">0</strong>
        </span>
        <span>
          Spread kept
          <strong className="book-kept">+0.00</strong>
        </span>
      </footer>
    </div>
  );
}
