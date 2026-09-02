"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const OPEN = 77098;
const STEP = 6;
const POINTS = 34;
const TICK = 0.7;
const KEEP = 0.04;
const RING = 2 * Math.PI * 34;

const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const nextQuarter = () =>
  new Date(Math.ceil(Date.now() / 900000) * 900000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function HeroWindow() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const arc = q<SVGCircleElement>(".win-arc")[0];
      const clockEl = q<SVGTextElement>(".win-clock")[0];
      const atEls = q<HTMLElement>(".win-at");
      const btc = q<HTMLElement>(".win-btc")[0];
      const line = q<SVGPathElement>(".win-line .line")[0];
      const chipUp = q<HTMLElement>(".win-taker.up")[0];
      const chipDown = q<HTMLElement>(".win-taker.down")[0];
      const token = q<HTMLElement>(".win-pair")[0];
      const slotUp = q<HTMLElement>(".win-side.up .win-slot")[0];
      const slotDown = q<HTMLElement>(".win-side.down .win-slot")[0];
      const barUp = q<HTMLElement>(".win-side.up .win-bar")[0];
      const barDown = q<HTMLElement>(".win-side.down .win-bar")[0];
      const waitUp = q<HTMLElement>(".win-side.up .w")[0];
      const takenUp = q<HTMLElement>(".win-side.up .t")[0];
      const waitDown = q<HTMLElement>(".win-side.down .w")[0];
      const takenDown = q<HTMLElement>(".win-side.down .t")[0];
      const sum = q<HTMLElement>(".win-sum")[0];
      const ledgerN = q<HTMLElement>(".win-n")[0];
      const ledgerK = q<HTMLElement>(".win-kept")[0];
      const mm = gsap.matchMedia();

      // The ring is the real quarter-hour window, the same clock the desk runs on.
      arc.style.strokeDasharray = String(RING);
      let lastSec = -1;
      const tickClock = () => {
        const left = 900 - ((Date.now() / 1000) % 900);
        arc.style.strokeDashoffset = String(RING * (1 - left / 900));
        const s = Math.floor(left);
        if (s !== lastSec) {
          if (s > lastSec) atEls.forEach((el) => (el.textContent = nextQuarter()));
          lastSec = s;
          clockEl.textContent = mmss(s);
        }
      };
      tickClock();
      gsap.ticker.add(tickClock);

      const samples: number[] = [];
      let v = OPEN - 30;
      const walk = () => {
        v += (Math.random() - 0.5) * 56 + (OPEN - v) * 0.02;
        return v;
      };
      for (let i = 0; i <= POINTS; i += 1) samples.push(walk());
      const yOf = (p: number) => gsap.utils.clamp(2, 42, 22 - (p - OPEN) / 3.2);
      const draw = () =>
        line.setAttribute("d", samples.map((p, i) => `${i ? "L" : "M"}${i * STEP} ${yOf(p).toFixed(2)}`).join(" "));
      draw();
      const price = { v: samples[samples.length - 1] };
      btc.textContent = usd(price.v);

      const roll = (el: HTMLElement, to: number, digits: number, prefix = "") => {
        const o = { v: Number(el.dataset.v ?? 0) };
        el.dataset.v = String(to);
        gsap.to(o, {
          v: to,
          duration: 0.6,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = prefix + o.v.toFixed(digits);
          },
        });
      };

      const R = (el: Element) => el.getBoundingClientRect();
      const measure = () => {
        const w = R(root);
        const su = R(slotUp);
        const sd = R(slotDown);
        const s = R(sum);
        const l = R(ledgerN);
        const cw = chipUp.offsetWidth;
        const ch = chipUp.offsetHeight;
        const upLeft = su.left - w.left + 10;
        const downLeft = sd.right - w.left - cw - 10;
        return {
          cw,
          ch,
          tw: token.offsetWidth,
          th: token.offsetHeight,
          upLeft,
          upTop: su.top - w.top + su.height / 2 - ch / 2,
          downLeft,
          downTop: sd.top - w.top + sd.height / 2 - ch / 2,
          upStart: -(upLeft + cw + 24),
          downStart: w.width - downLeft + 24,
          sumCx: s.left - w.left + s.width / 2,
          sumCy: s.top - w.top + s.height / 2,
          ledCx: l.left - w.left + l.width / 2,
          ledCy: l.top - w.top + l.height / 2,
        };
      };
      let m = measure();
      const place = () => {
        m = measure();
        gsap.set(chipUp, { left: m.upLeft, top: m.upTop, x: m.upStart, y: 0, scale: 1, autoAlpha: 1 });
        gsap.set(chipDown, { left: m.downLeft, top: m.downTop, x: m.downStart, y: 0, scale: 1, autoAlpha: 1 });
        gsap.set(token, { left: m.sumCx - m.tw / 2, top: m.sumCy - m.th / 2, x: 0, y: 0, scale: 0.8, autoAlpha: 0 });
      };

      mm.add("(prefers-reduced-motion: reduce)", () => {
        m = measure();
        gsap.set(chipUp, { left: m.upLeft, top: m.upTop, autoAlpha: 1 });
        gsap.set(chipDown, { left: m.downLeft, top: m.downTop, autoAlpha: 1 });
        gsap.set([barUp, barDown], { scaleX: 1 });
        gsap.set([waitUp, waitDown], { autoAlpha: 0 });
        gsap.set([takenUp, takenDown], { autoAlpha: 1 });
        ledgerN.textContent = "1";
        ledgerK.textContent = "+0.04";
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const shift = () => {
          samples.push(walk());
          samples.shift();
          draw();
          gsap.set(line, { x: 0 });
          gsap.to(line, { x: -STEP, duration: TICK, ease: "none", onComplete: shift });
          gsap.to(price, {
            v,
            duration: TICK,
            ease: "none",
            onUpdate: () => {
              btc.textContent = usd(price.v);
            },
          });
        };
        shift();

        let pairs = 0;
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, delay: 2.4 });
        tl.add(place, 0)
          .to(chipUp, { x: 0, duration: 1.3, ease: "power2.inOut" }, 0.05)
          .to(barUp, { scaleX: 1, duration: 0.7, ease: "power2.out" }, 1.3)
          .to(waitUp, { autoAlpha: 0, duration: 0.35 }, 1.4)
          .to(takenUp, { autoAlpha: 1, duration: 0.35 }, 1.5)
          .to(chipDown, { x: 0, duration: 1.3, ease: "power2.inOut" }, 2.2)
          .to(barDown, { scaleX: 1, duration: 0.7, ease: "power2.out" }, 3.5)
          .to(waitDown, { autoAlpha: 0, duration: 0.35 }, 3.6)
          .to(takenDown, { autoAlpha: 1, duration: 0.35 }, 3.7)
          .to(
            chipUp,
            {
              x: () => m.sumCx - m.cw / 2 - m.upLeft,
              y: () => m.sumCy - m.ch / 2 - m.upTop,
              scale: 0.85,
              duration: 1.0,
              ease: "power2.inOut",
            },
            4.8,
          )
          .to(
            chipDown,
            {
              x: () => m.sumCx - m.cw / 2 - m.downLeft,
              y: () => m.sumCy - m.ch / 2 - m.downTop,
              scale: 0.85,
              duration: 1.0,
              ease: "power2.inOut",
            },
            4.8,
          )
          .to([chipUp, chipDown], { autoAlpha: 0, duration: 0.3 }, 5.6)
          .to(token, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power2.out" }, 5.5)
          .to(
            token,
            {
              x: () => m.ledCx - m.sumCx,
              y: () => m.ledCy - m.sumCy,
              duration: 0.9,
              ease: "power2.inOut",
            },
            6.4,
          )
          .to(token, { autoAlpha: 0, scale: 0.7, duration: 0.3 }, 7.1)
          .add(() => {
            pairs += 1;
            roll(ledgerN, pairs, 0);
            roll(ledgerK, pairs * KEEP, 2, "+");
          }, 7.1)
          .to([barUp, barDown], { scaleX: 0, duration: 0.9, ease: "power2.inOut" }, 7.8)
          .to([takenUp, takenDown], { autoAlpha: 0, duration: 0.4 }, 7.8)
          .to([waitUp, waitDown], { autoAlpha: 1, duration: 0.4 }, 8.0);
      });

      return () => {
        gsap.ticker.remove(tickClock);
        mm.revert();
      };
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="win" aria-hidden="true">
      <div className="win-top">
        <svg className="win-ring" viewBox="0 0 80 80">
          <circle className="track" cx="40" cy="40" r="34" />
          <circle className="win-arc" cx="40" cy="40" r="34" />
          <text className="win-clock" x="40" y="45">
            15:00
          </text>
        </svg>
        <div className="win-px">
          <span className="win-k">BTC now</span>
          <strong className="win-btc">77,054.56</strong>
          <svg className="win-line" viewBox={`0 0 ${POINTS * STEP} 44`} preserveAspectRatio="none">
            <line className="open" x1="0" x2={POINTS * STEP} y1="22" y2="22" />
            <path className="line" d="" />
          </svg>
        </div>
      </div>

      <p className="win-q">
        Will BTC be above <b>{OPEN.toLocaleString("en-US")}</b> at <span className="win-at">the close</span>?
      </p>

      <div className="win-sides">
        <div className="win-side up">
          <span className="win-name">Up</span>
          <div className="win-pay">
            <strong>0.47</strong>
            <span className="win-state">
              <span className="w">waiting</span>
              <span className="t">taken</span>
            </span>
          </div>
          <div className="win-slot">
            <i className="win-bar" />
          </div>
        </div>
        <div className="win-side down">
          <span className="win-name">Down</span>
          <div className="win-pay">
            <span className="win-state">
              <span className="w">waiting</span>
              <span className="t">taken</span>
            </span>
            <strong>0.49</strong>
          </div>
          <div className="win-slot">
            <i className="win-bar" />
          </div>
        </div>
      </div>

      <div className="win-sum">
        <span>
          a pair costs <b>0.96</b>
        </span>
        <span>
          pays <b>1.00</b>
        </span>
        <span className="keep">
          you keep <b>0.04</b>
        </span>
      </div>

      <div className="win-ledger">
        <span>
          Pairs
          <strong className="win-n">0</strong>
        </span>
        <span>
          Kept
          <strong className="win-kept">+0.00</strong>
        </span>
      </div>

      <div className="win-lane">
        <div className="win-taker up">
          <i />
          0x3f0f…4c takes Up
        </div>
        <div className="win-taker down">
          <i />
          0xeb94…e1 takes Down
        </div>
        <div className="win-pair">1 pair, worth 1.00</div>
      </div>
    </div>
  );
}
