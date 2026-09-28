import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Chip, Eyebrow, FadeUp, WordRise, clamp, fadeAt, prog, useSceneFade, useSpring } from "../lib";

const VO = 20;
const at = (s: number) => VO + Math.round(s * 60);
const ANA = at(2.7);
const BEN = at(4.0);
const NOSELL = at(5.9);
const MINT = at(7.4);
const SPLIT = at(8.7);
const EQ = at(10.1);

const POOL = { x: 960, y: 560 };
const ANA_AT = { x: 330, y: 560 };
const BEN_AT = { x: 1590, y: 560 };

export const Half: React.FC<{ side: "up" | "down"; size: number; fill?: number }> = ({ side, size, fill = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible" }}>
    {side === "up" ? (
      <path d="M47.5 10 A40 40 0 0 0 47.5 90 Z" fill={C.copper} fillOpacity={0.1 + 0.9 * fill} stroke={C.ember} strokeWidth={2} />
    ) : (
      <path d="M52.5 10 A40 40 0 0 1 52.5 90 Z" fill={C.steel} fillOpacity={0.1 + 0.9 * fill} stroke={C.steelHot} strokeWidth={2} />
    )}
  </svg>
);

const Person: React.FC<{ name: string; side: "up" | "down"; price: string; delay: number; x: number; y: number }> = ({
  name,
  side,
  price,
  delay,
  x,
  y,
}) => {
  const p = useSpring(delay);
  const col = side === "up" ? C.ember : C.steelHot;
  const from = side === "up" ? -380 : 380;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 200,
        top: y - 170,
        width: 400,
        opacity: p,
        transform: `translateX(${(1 - p) * from}px)`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          width: 110,
          height: 110,
          borderRadius: 99,
          border: `3px solid ${col}`,
          display: "grid",
          placeItems: "center",
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: 48,
          color: col,
          background: "rgba(22,19,42,0.9)",
        }}
      >
        {name[0]}
      </div>
      <div style={{ marginTop: 20, fontFamily: F.display, fontWeight: 700, fontSize: 40, color: C.tape }}>{name}</div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
        <Chip tone={side}>
          buys {side.toUpperCase()} at {price}
        </Chip>
      </div>
    </div>
  );
};

export const Rule: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(dur);
  const lift = prog(frame, ANA - 10, ANA + 30);

  const coinP = prog(frame, MINT, MINT + 45);
  const poolGlow = prog(frame, MINT + 35, MINT + 60) * (1 - prog(frame, SPLIT + 30, SPLIT + 70));
  const pairIn = useSpring(MINT + 45);
  const fly = prog(frame, SPLIT, SPLIT + 55);
  const eqIn = useSpring(EQ);
  const sellerCross = prog(frame, NOSELL + 12, NOSELL + 30);

  return (
    <AbsoluteFill style={{ opacity: fade, fontFamily: F.display, color: C.tape }}>
      <div
        style={{
          position: "absolute",
          top: interpolate(lift, [0, 1], [380, 70]),
          width: "100%",
          textAlign: "center",
          transform: `scale(${interpolate(lift, [0, 1], [1, 0.62])})`,
          transformOrigin: "50% 0%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Eyebrow delay={4}>The rule</Eyebrow>
        </div>
        <WordRise
          text="One rule most people miss."
          delay={10}
          style={{ marginTop: 26, fontSize: 104, fontWeight: 800, letterSpacing: -2 }}
        />
      </div>

      <Person name="Ana" side="up" price="0.60" delay={ANA} x={ANA_AT.x} y={ANA_AT.y} />
      <Person name="Ben" side="down" price="0.40" delay={BEN} x={BEN_AT.x} y={BEN_AT.y} />

      {/* no seller */}
      <div
        style={{
          position: "absolute",
          left: POOL.x - 160,
          top: POOL.y - 70,
          width: 320,
          textAlign: "center",
          opacity: fadeAt(frame, NOSELL, MINT + 10),
        }}
      >
        <div style={{ position: "relative", display: "inline-block", fontSize: 54, fontWeight: 800, color: C.muted }}>
          seller
          <div
            style={{
              position: "absolute",
              left: -10,
              right: -10,
              top: "52%",
              height: 5,
              background: C.warn,
              transform: `scaleX(${sellerCross})`,
              transformOrigin: "left",
            }}
          />
        </div>
        <div style={{ marginTop: 14, fontFamily: F.mono, fontSize: 26, color: C.chalk, opacity: fadeAt(frame, NOSELL + 26) }}>
          nobody has to sell
        </div>
      </div>

      {/* the pool */}
      <div
        style={{
          position: "absolute",
          left: POOL.x - 150,
          top: POOL.y - 150,
          width: 300,
          height: 300,
          borderRadius: 999,
          border: `2px solid rgba(239,230,214,${0.25 + 0.5 * poolGlow})`,
          background: "rgba(22,19,42,0.85)",
          boxShadow: `0 0 ${120 * poolGlow}px rgba(232,160,96,${0.45 * poolGlow})`,
          opacity: fadeAt(frame, MINT - 6),
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ position: "absolute", top: -64, width: 420, left: -60, textAlign: "center", fontFamily: F.mono, fontSize: 26, color: C.muted }}>
          DreamDEX pool
        </div>
        <div
          style={{
            position: "absolute",
            bottom: -66,
            width: 420,
            left: -60,
            textAlign: "center",
            fontFamily: F.mono,
            fontSize: 28,
            color: C.chalk,
            opacity: fadeAt(frame, MINT + 40),
          }}
        >
          0.60 + 0.40 = <span style={{ color: C.ember }}>1.00 locked</span>
        </div>
      </div>

      {/* money flies in */}
      {(["up", "down"] as const).map((side) => {
        const from = side === "up" ? ANA_AT : BEN_AT;
        const x = interpolate(coinP, [0, 1], [from.x, POOL.x]);
        const y = interpolate(coinP, [0, 1], [from.y + 120, POOL.y], clamp) - Math.sin(coinP * Math.PI) * 90;
        const show = frame >= MINT && coinP < 1;
        return show ? (
          <div
            key={side}
            style={{
              position: "absolute",
              left: x - 60,
              top: y - 28,
              width: 120,
              textAlign: "center",
              fontFamily: F.mono,
              fontSize: 34,
              fontWeight: 500,
              color: C.ink,
              background: side === "up" ? C.ember : C.steelHot,
              borderRadius: 99,
              padding: "6px 0",
            }}
          >
            {side === "up" ? "0.60" : "0.40"}
          </div>
        ) : null;
      })}

      {/* the minted pair, then each half to its owner */}
      {frame >= MINT + 40
        ? (["up", "down"] as const).map((side) => {
            const to = side === "up" ? ANA_AT : BEN_AT;
            const x = interpolate(fly, [0, 1], [POOL.x + (side === "up" ? -4 : 4), to.x + (side === "up" ? 130 : -130)]);
            const y = interpolate(fly, [0, 1], [POOL.y, to.y - 150]) - Math.sin(fly * Math.PI) * 110;
            const size = interpolate(fly, [0, 1], [230, 110]);
            return (
              <div
                key={side}
                style={{ position: "absolute", left: x - size / 2, top: y - size / 2, opacity: pairIn, transform: `scale(${0.6 + 0.4 * pairIn})` }}
              >
                <Half side={side} size={size} />
              </div>
            );
          })
        : null}

      {/* the equation */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 850,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          opacity: eqIn,
          transform: `translateY(${(1 - eqIn) * 30}px)`,
          fontSize: 64,
          fontWeight: 800,
        }}
      >
        <Half side="up" size={96} />
        <span style={{ color: C.ember }}>UP</span>
        <span style={{ color: C.muted }}>+</span>
        <Half side="down" size={96} />
        <span style={{ color: C.steelHot }}>DOWN</span>
        <span style={{ color: C.muted }}>=</span>
        <span style={{ fontFamily: F.mono, fontWeight: 500, color: C.tape }}>1.00</span>
        <FadeUp delay={EQ + 50} y={14}>
          <span style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 400, color: C.muted, marginLeft: 24 }}>always</span>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
