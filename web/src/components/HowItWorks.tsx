"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin);

const SHOTS = [
  {
    k: "Watch the window",
    v: "A DreamDEX BTC 15m Event Contract is a clock plus a direction. HOUSE arms on the live window.",
  },
  {
    k: "Rest Up below mid",
    v: "PostOnly BUY_YES sits under the fair Up probability. You are a buyer, not a seller.",
  },
  {
    k: "Rest Down above mid",
    v: "BUY_NO is priced in YES terms, so the implied Up ask sits above mid. Spread is locked in.",
  },
  {
    k: "Takers mint the pair",
    v: "When both sides fill, the pool mints a complete set. No inventory to start. You keep the spread.",
  },
  {
    k: "Flatten, then redeem",
    v: "Sell leftovers while the window is open. After resolve, redeem settled payouts.",
  },
];

// Stage geometry. x is time across the 15m window, y is the Up probability.
const X0 = 120;
const X1 = 1080;
const Y0 = 560;
const Y1 = 80;
const px = (t: number) => X0 + t * (X1 - X0);
const py = (p: number) => Y0 - p * (Y0 - Y1);

const BID = 0.48;
const ASK = 0.52;
const T_BID = 0.216;
const T_ASK = 0.364;
const T_FILL = 0.59;
const SHOT_AT = [0.08, 0.24, 0.4, 0.56, 0.78];
const PLAY_FROM = 8;
const PLAY_TO = 96;

const FAIR: [number, number][] = [
  [0, 0.5],
  [0.083, 0.53],
  [0.167, 0.49],
  [0.216, 0.5],
  [0.29, 0.512],
  [0.365, 0.49],
  [0.44, 0.505],
  [0.5, 0.487],
  [0.59, 0.5],
  [0.646, 0.56],
  [0.708, 0.62],
  [0.77, 0.58],
  [0.844, 0.7],
  [0.917, 0.82],
  [0.969, 0.9],
  [1, 1],
];

function smoothPath(pts: [number, number][]) {
  const p = pts.map(([t, v]) => [px(t), py(v)]);
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

const FAIR_D = smoothPath(FAIR);

function timecode(t: number) {
  const s = t * 900;
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  const ff = String(Math.floor((s % 1) * 100)).padStart(2, "0");
  return `${mm}:${ss}.${ff}`;
}

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(
        {
          desk: "(min-width: 860px)",
          mobile: "(max-width: 859px)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const c = ctx.conditions as { desk: boolean; motion: boolean };
          if (!c.motion) return;
          root.classList.add("is-live");

          const svg = q<SVGSVGElement>(".cine-svg")[0];
          const fair = q<SVGPathElement>(".cine-fair")[0];
          const headLine = q<SVGLineElement>(".cine-head line")[0];
          const headDot = q<SVGCircleElement>(".cine-head circle")[0];
          const bid = q<SVGLineElement>(".cine-bid")[0];
          const ask = q<SVGLineElement>(".cine-ask")[0];
          const spread = q<SVGRectElement>(".cine-spread")[0];
          const spreadTag = q<SVGGElement>(".cine-spread-tag")[0];
          const kicker = q<HTMLElement>(".cine-copy .land-kicker")[0];
          const tc = q<HTMLElement>(".cine-tc strong")[0];
          const status = q<HTMLElement>(".cine-status")[0];
          const count = q<HTMLElement>(".cine-count strong")[0];
          const segs = q<HTMLElement>(".cine-seg i");
          const shots = q<HTMLElement>(".cine-shot");
          const bars = q<HTMLElement>(".cine-bar");
          const title = q<HTMLElement>(".cine-title")[0];
          const hits = q<SVGCircleElement>(".cine-hit");

          // Map an x position to a length along the fair line so the drawn
          // line always ends exactly under the playhead.
          const L = fair.getTotalLength();
          const N = 500;
          const sx: number[] = [];
          const sl: number[] = [];
          for (let i = 0; i <= N; i++) {
            const l = (L * i) / N;
            sx.push(fair.getPointAtLength(l).x);
            sl.push(l);
          }
          const lenAt = (x: number) => {
            let lo = 0;
            let hi = N;
            while (lo < hi) {
              const m = (lo + hi) >> 1;
              if (sx[m] < x) lo = m + 1;
              else hi = m;
            }
            if (lo === 0) return 0;
            const f = (x - sx[lo - 1]) / (sx[lo] - sx[lo - 1] || 1);
            return sl[lo - 1] + f * (sl[lo] - sl[lo - 1]);
          };

          const clock = { t: 0 };
          const render = () => {
            const t = clock.t;
            const x = px(t);
            const len = Math.min(L, lenAt(x));
            fair.style.strokeDasharray = `${L}`;
            fair.style.strokeDashoffset = `${L - len}`;
            const pt = fair.getPointAtLength(len);
            headLine.setAttribute("x1", `${x}`);
            headLine.setAttribute("x2", `${x}`);
            headDot.setAttribute("cx", `${pt.x}`);
            headDot.setAttribute("cy", `${pt.y}`);
            const bx = Math.min(x, px(T_FILL));
            bid.setAttribute("x2", `${Math.max(px(T_BID), bx)}`);
            ask.setAttribute("x2", `${Math.max(px(T_ASK), bx)}`);
            spread.setAttribute("width", `${Math.max(0, bx - px(T_ASK))}`);
            spreadTag.setAttribute("transform", `translate(${bx} 0)`);
            tc.textContent = timecode(t);
            const done = t >= 0.985;
            status.textContent = done ? "Resolved" : "Trading";
            status.classList.toggle("is-done", done);
          };
          render();

          let cur = -2;
          gsap.set(shots, { autoAlpha: 0 });
          gsap.set(hits, { autoAlpha: 0 });
          const setShot = (p: number) => {
            let idx = -1;
            for (let i = 0; i < SHOT_AT.length; i++) if (p >= SHOT_AT[i]) idx = i;
            segs.forEach((seg, i) => {
              const a = SHOT_AT[i];
              const b = SHOT_AT[i + 1] ?? 1;
              gsap.set(seg, { scaleX: gsap.utils.clamp(0, 1, (p - a) / (b - a)) });
            });
            if (idx === cur) return;
            const prev = shots[cur];
            cur = idx;
            if (prev) gsap.to(prev, { autoAlpha: 0, y: -10, duration: 0.26, ease: "power2.in", overwrite: true });
            const next = shots[idx];
            if (next) {
              gsap.fromTo(
                next,
                { autoAlpha: 0, y: 18 },
                { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", overwrite: true, delay: prev ? 0.28 : 0.05 },
              );
            }
            count.textContent = idx < 0 ? "00" : `0${idx + 1}`;
          };

          const zoom = c.desk ? "160 140 720 384" : "220 170 520 277";

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "+=4400",
              pin: true,
              scrub: 0.6,
              anticipatePin: 1,
              onUpdate: (self) => setShot(self.progress),
            },
          });

          tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 6, ease: "power2.out" }, 0)
            .fromTo(title, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 3, ease: "power2.out" }, 0)
            .to(title, { autoAlpha: 0, scale: 1.05, y: -24, duration: 3, ease: "power2.in" }, 5)
            .fromTo(q(".cine-grid"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 6)
            .fromTo(q(".cine-grid line"), { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 5, stagger: 0.3 }, 6)
            .fromTo(q(".cine-axis"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 3 }, 8)
            .fromTo(q(".cine-window line"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 3, stagger: 1 }, 9)
            .fromTo(q(".cine-window text"), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 2, stagger: 1 }, 10)
            .fromTo(q(".cine-head"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 10)
            .fromTo(kicker, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 8)
            .to(clock, { t: 1, duration: PLAY_TO - PLAY_FROM, onUpdate: render }, PLAY_FROM)
            .to(svg, { attr: { viewBox: zoom }, duration: 6, ease: "power2.inOut" }, 22)
            .to(q(".cine-axis"), { autoAlpha: 0, duration: 4 }, 22)
            .fromTo(
              q(".cine-mid"),
              { scaleX: 0, autoAlpha: 0, transformOrigin: "0% 50%" },
              { scaleX: 1, autoAlpha: 1, duration: 3 },
              24,
            )
            .fromTo(q(".cine-mid-l"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 25)
            .fromTo(q(".cine-bid, .cine-bid-l"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 27.5)
            .fromTo(q(".cine-ask, .cine-ask-l"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 41)
            .fromTo(q(".cine-spread"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 3 }, 44)
            .fromTo(spreadTag, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, 44)
            .to(spreadTag, { autoAlpha: 0, duration: 2 }, 61)
            .set(hits, { autoAlpha: 0.9, attr: { r: 2 } }, 60)
            .to(hits, { autoAlpha: 0, attr: { r: 30 }, duration: 4, ease: "power2.out" }, 60.01)
            .fromTo(q(".cine-set-yes"), { x: -26, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 4, ease: "power3.out" }, 62)
            .fromTo(q(".cine-set-no"), { x: 26, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 4, ease: "power3.out" }, 62)
            .fromTo(
              q(".cine-set-ring"),
              { scale: 0.2, autoAlpha: 0, transformOrigin: "50% 50%" },
              { scale: 1, autoAlpha: 1, duration: 4, ease: "back.out(2)" },
              63,
            )
            .fromTo(q(".cine-set text"), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 3, stagger: 1 }, 66)
            .to(svg, { attr: { viewBox: "0 0 1200 640" }, duration: 6, ease: "power2.inOut" }, 78)
            .to(q(".cine-axis"), { autoAlpha: 1, duration: 4 }, 80)
            .fromTo(q(".cine-end text"), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 3, stagger: 1.5 }, 94)
            .to(bars, { scaleY: 0, duration: 4, ease: "power2.in" }, 96);

          setShot(0);
        },
      );

      return () => {
        root.classList.remove("is-live");
        mm.revert();
      };
    },
    { scope: ref },
  );

  const fillX = px(T_FILL);

  return (
    <section ref={ref} className="cine" id="how">
      <div className="cine-vignette" aria-hidden="true" />
      <div className="cine-grain" aria-hidden="true" />
      <div className="cine-bar cine-bar-top" aria-hidden="true" />
      <div className="cine-bar cine-bar-bottom" aria-hidden="true" />

      <div className="cine-title">
        <h2>Five moves. One window.</h2>
        <p>Fifteen minutes on the tape</p>
      </div>

      <div className="cine-inner">
        <div className="cine-copy">
          <p className="land-kicker">How it works</p>
          <div className="cine-shots">
            {SHOTS.map((s, i) => (
              <div className="cine-shot" key={s.k}>
                <span className="cine-num">0{i + 1}</span>
                <h3>{s.k}</h3>
                <p>{s.v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="cine-stage">
          <svg className="cine-svg" viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <g className="cine-grid">
              {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                <line key={p} x1={X0} x2={X1} y1={py(p)} y2={py(p)} />
              ))}
              {[0.25, 0.5, 0.75].map((t) => (
                <line key={t} x1={px(t)} x2={px(t)} y1={Y1} y2={Y0} />
              ))}
            </g>

            <g className="cine-axis">
              <text x={X0 - 18} y={py(1) + 4} textAnchor="end">1.00</text>
              <text x={X0 - 18} y={py(0.5) + 4} textAnchor="end">0.50</text>
              <text x={X0 - 18} y={py(0) + 4} textAnchor="end">0.00</text>
              <text x={X0} y={Y0 + 34}>00:00</text>
              <text x={px(1 / 3)} y={Y0 + 34} textAnchor="middle">05:00</text>
              <text x={px(2 / 3)} y={Y0 + 34} textAnchor="middle">10:00</text>
              <text x={X1} y={Y0 + 34} textAnchor="end">15:00</text>
            </g>

            <g className="cine-window">
              <line x1={X0} x2={X0} y1={Y1 - 16} y2={Y0 + 12} />
              <line x1={X1} x2={X1} y1={Y1 - 16} y2={Y0 + 12} />
              <text x={X0 + 10} y={Y1 - 24}>Open</text>
              <text x={X1 - 10} y={Y1 - 24} textAnchor="end">Close</text>
            </g>

            <line className="cine-mid" x1={X0} x2={X1} y1={py(0.5)} y2={py(0.5)} />
            <text className="cine-mid-l cine-lbl" x={X1 - 10} y={py(0.5) - 8} textAnchor="end">
              mid 0.50
            </text>

            <rect className="cine-spread" x={px(T_ASK)} y={py(ASK)} width={fillX - px(T_ASK)} height={py(BID) - py(ASK)} />
            <g className="cine-spread-tag" transform={`translate(${fillX} 0)`}>
              <path d={`M8,${py(ASK)} h6 V${py(BID)} h-6`} />
              <text className="cine-lbl" x={22} y={py(0.5) + 4}>
                spread 0.04
              </text>
            </g>

            <line className="cine-bid" x1={px(T_BID)} x2={fillX} y1={py(BID)} y2={py(BID)} />
            <text className="cine-bid-l cine-lbl" x={px(T_BID)} y={py(BID) + 18}>
              BUY_YES 0.48
            </text>

            <line className="cine-ask" x1={px(T_ASK)} x2={fillX} y1={py(ASK)} y2={py(ASK)} />
            <text className="cine-ask-l cine-lbl" x={px(T_ASK)} y={py(ASK) - 10}>
              BUY_NO, Up ask 0.52
            </text>

            <circle className="cine-hit cine-hit-up" cx={fillX} cy={py(BID)} r={2} />
            <circle className="cine-hit cine-hit-down" cx={fillX} cy={py(ASK)} r={2} />

            <g className="cine-set" transform={`translate(${fillX} ${py(0.5) - 92})`}>
              <path className="cine-set-yes" d="M0,-18 A18,18 0 0 0 0,18 Z" />
              <path className="cine-set-no" d="M0,-18 A18,18 0 0 1 0,18 Z" />
              <circle className="cine-set-ring" r={18} />
              <text className="cine-lbl" y={36} textAnchor="middle">complete set</text>
              <text className="cine-lbl" y={52} textAnchor="middle">1 YES + 1 NO</text>
            </g>

            <path className="cine-fair" d={FAIR_D} />

            <g className="cine-head">
              <line x1={X1} x2={X1} y1={Y1 - 16} y2={Y0 + 12} />
              <circle cx={X1} cy={py(1)} r={5} />
            </g>

            <g className="cine-end">
              <text x={X1 - 12} y={py(0.1)} textAnchor="end">Resolved Up</text>
              <text x={X1 - 12} y={py(0.1) + 20} textAnchor="end">Redeem YES at 1.00</text>
            </g>
          </svg>
        </div>
      </div>

      <div className="cine-hud" aria-hidden="true">
        <div className="cine-count">
          <span>Move </span>
          <strong>00</strong>
          <span> / 05</span>
          <div className="cine-segs">
            {SHOTS.map((s) => (
              <span className="cine-seg" key={s.k}>
                <i />
              </span>
            ))}
          </div>
        </div>
        <div className="cine-tc">
          <span className="cine-status">Trading</span>
          <strong>00:00.00</strong>
        </div>
      </div>
    </section>
  );
}
