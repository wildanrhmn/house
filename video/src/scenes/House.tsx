import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Chip, FadeUp, Pair, WordRise, clamp, fadeAt, prog, useSceneFade, useSpring } from "../lib";

const VO = 20;
const at = (s: number) => VO + Math.round(s * 60);
const HOUSE_IN = at(2.8);
const PRICES = at(5.2);
const SUM = at(7.6);
const TAKERS = at(10.1);
const FULL = at(11.9);
const WORTH = at(13.2);

const CENTER = { x: 960, y: 500 };
const TAG = { up: { x: 430, y: 500 }, down: { x: 1490, y: 500 } };

export const House: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(dur);

  const titleOut = prog(frame, HOUSE_IN - 14, HOUSE_IN + 10);
  const houseIn = useSpring(HOUSE_IN);
  const tagIn = { up: useSpring(PRICES), down: useSpring(PRICES + 14) };
  const sumIn = useSpring(SUM);
  const hitUp = TAKERS + 50;
  const hitDown = TAKERS + 62;
  const joined = prog(frame, FULL - 10, FULL + 30);
  const worthIn = useSpring(WORTH);

  const fillUp = prog(frame, hitUp, hitUp + 20);
  const fillDown = prog(frame, hitDown, hitDown + 20);
  const split = interpolate(joined, [0, 1], [26, 0]);
  const glow = prog(frame, FULL, FULL + 40);
  const keep = interpolate(prog(frame, WORTH + 20, WORTH + 70), [0, 1], [0, 0.02]);

  return (
    <AbsoluteFill style={{ opacity: fade, fontFamily: F.display, color: C.tape }}>
      <div style={{ position: "absolute", top: 390, width: "100%", opacity: 1 - titleOut }}>
        <WordRise
          text="What if you stopped picking sides?"
          delay={10}
          style={{ fontSize: 110, fontWeight: 800, letterSpacing: -2, maxWidth: 1500, margin: "0 auto", lineHeight: 1.05 }}
        />
      </div>

      {/* HOUSE in the middle */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x - 170,
          top: CENTER.y - 190,
          width: 340,
          textAlign: "center",
          opacity: houseIn,
          transform: `scale(${0.7 + 0.3 * houseIn})`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Pair size={260} split={split} fillUp={fillUp} fillDown={fillDown} glow={glow} />
        </div>
        <div style={{ marginTop: 6, fontWeight: 800, fontSize: 44, letterSpacing: 10 }}>HOUSE</div>
        <div style={{ marginTop: 4, fontFamily: F.mono, fontSize: 22, color: C.muted }}>any wallet</div>
      </div>

      {/* 1.00 inside the finished pair */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x - 100,
          top: CENTER.y - 92,
          width: 200,
          textAlign: "center",
          fontFamily: F.mono,
          fontWeight: 500,
          fontSize: 42,
          color: C.ink,
          opacity: glow,
          transform: `scale(${0.8 + 0.2 * glow})`,
          textShadow: "0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        1.00
      </div>

      {/* resting prices */}
      {(["up", "down"] as const).map((side) => {
        const t = TAG[side];
        const p = tagIn[side];
        const hit = side === "up" ? hitUp : hitDown;
        const taken = frame >= hit;
        const col = side === "up" ? C.ember : C.steelHot;
        return (
          <div key={side}>
            <svg
              style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: p * 0.6 }}
              width={1920}
              height={1080}
            >
              <line
                x1={side === "up" ? t.x + 190 : t.x - 190}
                y1={t.y}
                x2={side === "up" ? CENTER.x - 150 : CENTER.x + 150}
                y2={CENTER.y - 40}
                stroke={col}
                strokeWidth={2}
                strokeDasharray="4 8"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                left: t.x - 205,
                top: t.y - 110,
                width: 410,
                padding: "26px 30px",
                borderRadius: 24,
                border: `2px solid ${col}`,
                background: taken ? (side === "up" ? "rgba(201,132,58,0.16)" : "rgba(111,160,191,0.16)") : C.card,
                opacity: p,
                transform: `translateY(${(1 - p) * 40}px) scale(${taken ? 1 + 0.05 * (1 - prog(frame, hit, hit + 20)) : 1})`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 32, letterSpacing: 3, color: col }}>{side.toUpperCase()}</span>
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 18,
                    letterSpacing: 2,
                    padding: "5px 12px",
                    borderRadius: 99,
                    background: taken ? C.tape : "rgba(239,230,214,0.08)",
                    color: taken ? C.ink : C.muted,
                  }}
                >
                  {taken ? "TAKEN" : "WAITING"}
                </span>
              </div>
              <div style={{ marginTop: 14, fontFamily: F.mono, fontSize: 64, fontWeight: 500 }}>0.49</div>
              <div style={{ fontFamily: F.mono, fontSize: 22, color: C.muted }}>you pay</div>
            </div>
          </div>
        );
      })}

      {/* the sum */}
      <div
        style={{
          position: "absolute",
          left: 360,
          width: 1200,
          top: 760,
          opacity: sumIn * (1 - fadeAt(frame, WORTH - 10) * 0),
          transform: `translateY(${(1 - sumIn) * 30}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 28, color: C.chalk }}>
          <span>
            0.49 + 0.49 = <span style={{ color: C.tape, fontWeight: 500 }}>0.98</span>
          </span>
          <span style={{ color: C.muted }}>a pair pays 1.00</span>
        </div>
        <div style={{ position: "relative", marginTop: 16, height: 18, borderRadius: 99, background: "rgba(239,230,214,0.08)" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${98 * prog(frame, SUM + 10, SUM + 60)}%`,
              borderRadius: 99,
              background: `linear-gradient(90deg, ${C.copper}, ${C.steel})`,
            }}
          />
          <div style={{ position: "absolute", right: 0, top: -10, bottom: -10, width: 3, background: C.tape }} />
        </div>
        <div
          style={{
            marginTop: 26,
            textAlign: "center",
            fontSize: 46,
            fontWeight: 800,
            opacity: worthIn,
            transform: `translateY(${(1 - worthIn) * 16}px)`,
          }}
        >
          Worth 1.00 whatever Bitcoin does. You keep{" "}
          <span style={{ fontFamily: F.mono, fontWeight: 500, color: C.ember }}>+{keep.toFixed(2)}</span>
        </div>
      </div>

      {/* takers cross both prices */}
      {(["up", "down"] as const).map((side) => {
        const hit = side === "up" ? hitUp : hitDown;
        const start = hit - 50;
        const p = prog(frame, start, hit, (t) => t * t * (3 - 2 * t));
        if (frame < start || frame > hit + 16) return null;
        const t = TAG[side];
        const fromX = side === "up" ? -420 : 2340;
        const x = interpolate(p, [0, 1], [fromX, side === "up" ? t.x - 120 : t.x + 120], clamp);
        return (
          <div
            key={side}
            style={{
              position: "absolute",
              left: x - 150,
              top: t.y - 180,
              width: 300,
              display: "flex",
              justifyContent: "center",
              opacity: 1 - prog(frame, hit, hit + 16),
            }}
          >
            <Chip tone={side === "up" ? "down" : "up"}>taker wants {side === "up" ? "DOWN" : "UP"}</Chip>
          </div>
        );
      })}

      <FadeUp delay={TAKERS} y={10} style={{ position: "absolute", top: 90, width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: F.mono, fontSize: 28, color: C.muted, opacity: 1 - prog(frame, FULL + 60, FULL + 80) }}>
          each cross mints a pair, one half lands with you
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};
