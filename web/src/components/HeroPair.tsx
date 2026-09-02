"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const INK = "#16132a";
const TAPE = "#efe6d6";
const KEEP = 0.04;

export function HeroPair() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const up = q<SVGGElement>(".pair-up")[0];
      const down = q<SVGGElement>(".pair-down")[0];
      const upDisc = up.querySelector<SVGPathElement>(".disc")!;
      const downDisc = down.querySelector<SVGPathElement>(".disc")!;
      const takeUp = q<SVGRectElement>(".pair-take.up")[0];
      const takeDown = q<SVGRectElement>(".pair-take.down")[0];
      const worth = q<SVGGElement>(".pair-worth")[0];
      const labels = q<SVGTextElement>(".pair-side, .pair-px");
      const cap = q<HTMLElement>(".pair-cap span")[0];
      const count = q<HTMLElement>(".pair-n")[0];
      const kept = q<HTMLElement>(".pair-kept")[0];
      const mm = gsap.matchMedia();

      gsap.set(up, { x: -14 });
      gsap.set(down, { x: 14 });
      gsap.set(worth, { autoAlpha: 0, scale: 0.9, transformOrigin: "50% 50%" });
      gsap.set([takeUp, takeDown], { autoAlpha: 0 });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([upDisc, downDisc], { fillOpacity: 1 });
        gsap.set([up, down], { color: INK, x: 0 });
        gsap.set(labels, { autoAlpha: 0 });
        gsap.set(worth, { autoAlpha: 1, scale: 1 });
        cap.textContent = "One pair, worth 1.00, cost 0.96.";
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        let pairs = 0;
        const say = (tl: gsap.core.Timeline, text: string, at: number) =>
          tl
            .to(cap, { autoAlpha: 0, y: -4, duration: 0.2 }, at)
            .add(() => {
              cap.textContent = text;
            }, at + 0.2)
            .to(cap, { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.22);

        const take = (
          tl: gsap.core.Timeline,
          rect: SVGRectElement,
          from: number,
          to: number,
          disc: SVGPathElement,
          group: SVGGElement,
          at: number,
        ) =>
          tl
            .set(rect, { attr: { x: from }, autoAlpha: 1 }, at)
            .to(rect, { attr: { x: to }, duration: 0.7, ease: "power2.in" }, at)
            .to(rect, { autoAlpha: 0, duration: 0.1 }, at + 0.7)
            .to(disc, { fillOpacity: 1, duration: 0.25 }, at + 0.7)
            .to(group, { color: INK, duration: 0.25 }, at + 0.7);

        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 2.2 });
        take(tl, takeUp, -60, 40, upDisc, up, 0.9);
        say(tl, "Up taken. You hold Up.", 1.7);
        take(tl, takeDown, 392, 292, downDisc, down, 2.9);
        say(tl, "Down taken. You hold Down.", 3.7);
        tl.to(up, { x: -1, duration: 0.6, ease: "power3.inOut" }, 5.0)
          .to(down, { x: 1, duration: 0.6, ease: "power3.inOut" }, 5.0)
          .to(labels, { autoAlpha: 0, duration: 0.3 }, 5.2)
          .to(
            worth,
            {
              autoAlpha: 1,
              scale: 1,
              duration: 0.35,
              ease: "back.out(2)",
              onStart: () => {
                pairs += 1;
                count.textContent = String(pairs);
                kept.textContent = "+" + (pairs * KEEP).toFixed(2);
              },
            },
            5.5,
          );
        say(tl, "One pair, worth 1.00, cost 0.96.", 5.6);
        tl.to(worth, { autoAlpha: 0, duration: 0.3 }, 7.8)
          .to([upDisc, downDisc], { fillOpacity: 0.1, duration: 0.4 }, 7.8)
          .to([up, down], { color: TAPE, duration: 0.4 }, 7.8)
          .to(up, { x: -14, duration: 0.6, ease: "power3.inOut" }, 7.9)
          .to(down, { x: 14, duration: 0.6, ease: "power3.inOut" }, 7.9)
          .to(labels, { autoAlpha: 1, duration: 0.3 }, 8.1);
        say(tl, "Two prices, resting.", 8.0);
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="pair" aria-hidden="true">
      <svg className="pair-svg" viewBox="0 20 360 240">
        <circle className="pair-ring" cx="180" cy="140" r="110" />
        <g className="pair-half pair-up">
          <path className="disc" d="M180 44 A96 96 0 0 0 180 236 Z" />
          <text className="pair-side" x="134" y="118">
            UP
          </text>
          <text className="pair-px" x="134" y="160">
            0.47
          </text>
        </g>
        <g className="pair-half pair-down">
          <path className="disc" d="M180 44 A96 96 0 0 1 180 236 Z" />
          <text className="pair-side" x="226" y="118">
            DOWN
          </text>
          <text className="pair-px" x="226" y="160">
            0.49
          </text>
        </g>
        <rect className="pair-take up" x="-60" y="137.5" width="28" height="5" rx="2.5" />
        <rect className="pair-take down" x="392" y="137.5" width="28" height="5" rx="2.5" />
        <g className="pair-worth">
          <rect x="141" y="106" width="78" height="66" rx="10" />
          <text className="k" x="180" y="127">
            WORTH
          </text>
          <text className="v" x="180" y="160">
            1.00
          </text>
        </g>
      </svg>
      <p className="pair-cap">
        <span>Two prices, resting.</span>
      </p>
      <div className="pair-ledger">
        <span>
          Pairs
          <strong className="pair-n">0</strong>
        </span>
        <span>
          Kept
          <strong className="pair-kept">+0.00</strong>
        </span>
      </div>
    </div>
  );
}
