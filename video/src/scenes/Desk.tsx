import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { BrowserFrame, Chip, fadeAt, prog, useSceneFade, useSpring } from "../lib";

const VO = 20;
const at = (s: number) => VO + Math.round(s * 60);
const CHECK = at(1.5);
const TAKEN = at(6.0);
const CASH = at(7.5);
const GAP = at(8.5);

const W = 1500;
const H = Math.round((W * 1800) / 3200);

// Positions on the screenshot as fractions of its size.
const spot = (fx: number, fy: number) => ({ x: fx * W, y: fy * H });
const TAKEN_UP = spot(0.458, 0.608);
const TAKEN_DOWN = spot(0.72, 0.608);
const BALANCE = spot(0.715, 0.045);

const Ring: React.FC<{ x: number; y: number; w: number; h: number; delay: number; color?: string }> = ({
  x,
  y,
  w,
  h,
  delay,
  color = C.ember,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, delay + 22);
  const pulse = 1 + 0.06 * Math.sin((frame - delay) / 6) * (frame > delay + 22 ? 1 : 0);
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: 999,
        border: `3px solid ${color}`,
        boxShadow: `0 0 30px ${color}`,
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [1.6, 1]) * pulse})`,
      }}
    />
  );
};

export const Desk: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(dur);
  const inP = useSpring(0);
  const zoom = interpolate(frame, [0, dur], [1, 1.045]);
  const gapIn = useSpring(GAP);

  return (
    <AbsoluteFill style={{ opacity: fade, fontFamily: F.display, color: C.tape }}>
      <div
        style={{
          position: "absolute",
          left: (1920 - W) / 2,
          top: 60,
          opacity: inP,
          transform: `translateY(${(1 - inP) * 60}px) scale(${zoom})`,
          transformOrigin: "50% 60%",
        }}
      >
        <BrowserFrame url="bethebook.xyz/desk" width={W}>
          {(["waiting", "taken", "cashed"] as const).map((s) => {
            const from = s === "waiting" ? 0 : s === "taken" ? TAKEN : CASH;
            const o = s === "waiting" ? 1 : prog(frame, from, from + 12);
            if (frame < from - 1 && s !== "waiting") return null;
            return (
              <Img
                key={s}
                src={staticFile(`img/desk-${s === "waiting" ? "1-waiting" : s === "taken" ? "2-taken" : "3-cashed"}.png`)}
                style={{ position: s === "waiting" ? "relative" : "absolute", left: 0, top: 0, width: W, height: H, display: "block", opacity: o }}
              />
            );
          })}
          {frame >= TAKEN && frame < CASH ? (
            <>
              <Ring x={TAKEN_UP.x} y={TAKEN_UP.y} w={120} h={46} delay={TAKEN + 4} />
              <Ring x={TAKEN_DOWN.x} y={TAKEN_DOWN.y} w={120} h={46} delay={TAKEN + 10} color={C.steelHot} />
            </>
          ) : null}
          {frame >= CASH ? <Ring x={BALANCE.x} y={BALANCE.y} w={230} h={48} delay={CASH + 6} /> : null}
        </BrowserFrame>
      </div>

      {/* callouts */}
      <div style={{ position: "absolute", bottom: 48, width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", height: 70, width: 1400 }}>
          {[
            { from: CHECK, to: TAKEN, text: "✓ Checked against the pool before you sign", tone: "plain" as const },
            { from: TAKEN, to: CASH, text: "Both sides taken: you hold 5 full pairs", tone: "up" as const },
            { from: CASH, to: GAP, text: "Cash out: 5 pairs back for 5.00", tone: "down" as const },
          ].map((c) => (
            <div
              key={c.text}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                opacity: fadeAt(frame, c.from, c.to + 6, 10),
              }}
            >
              <Chip tone={c.tone} big>
                {c.text}
              </Chip>
            </div>
          ))}
        </div>
      </div>

      {/* the gap is yours */}
      <AbsoluteFill
        style={{
          background: `rgba(12,10,26,${0.72 * gapIn})`,
          display: "grid",
          placeItems: "center",
          opacity: gapIn,
        }}
      >
        <div style={{ textAlign: "center", transform: `scale(${0.9 + 0.1 * gapIn})` }}>
          <div style={{ fontWeight: 800, fontSize: 120, letterSpacing: -2 }}>The gap is yours.</div>
          <div style={{ marginTop: 26, fontFamily: F.mono, fontSize: 44, color: C.chalk }}>
            paid 0.979 a pair, got 1.000 back ={" "}
            <span style={{ color: C.ember }}>+{interpolate(prog(frame, GAP + 10, GAP + 60), [0, 1], [0, 0.021]).toFixed(3)}</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
