import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Eyebrow, WordRise, clamp, fadeAt, prog, useSceneFade, useSpring } from "../lib";

const VO = 20;
const at = (s: number) => VO + Math.round(s * 60);
const Q = at(2.3);
const SPLIT = at(4.6);
const HOPE = at(7.2);

const DOTS = 56;
const COL_X = { up: 560, down: 1360 };

export const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(dur);

  const ringP = prog(frame, 0, dur, (t) => t);
  const lift = prog(frame, SPLIT, SPLIT + 40);
  const colIn = useSpring(SPLIT + 10);
  const upCount = Array.from({ length: DOTS }).filter((_, i) => random(`side${i}`) < 0.5 && frame > SPLIT + 30 + i * 4 + 36).length;
  const downCount = Array.from({ length: DOTS }).filter((_, i) => random(`side${i}`) >= 0.5 && frame > SPLIT + 30 + i * 4 + 36).length;

  let upIdx = 0;
  let downIdx = 0;

  return (
    <AbsoluteFill style={{ opacity: fade, fontFamily: F.display, color: C.tape }}>
      {/* the window clock */}
      <div style={{ position: "absolute", left: 960 - 60, top: interpolate(lift, [0, 1], [150, 70]), opacity: fadeAt(frame, 0) }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={52} fill="none" stroke="rgba(239,230,214,0.12)" strokeWidth={5} />
          <circle
            cx={60}
            cy={60}
            r={52}
            fill="none"
            stroke={C.ember}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={2 * Math.PI * 52 * ringP * 0.35}
            transform="rotate(-90 60 60)"
          />
          <text x={60} y={68} textAnchor="middle" fill={C.tape} fontFamily={F.mono} fontSize={22}>
            {`${String(59 - Math.floor(frame / 60)).padStart(2, "0")}:${String(59 - (Math.floor(frame) % 60)).padStart(2, "0")}`}
          </text>
        </svg>
      </div>

      <div style={{ position: "absolute", top: interpolate(lift, [0, 1], [320, 210]), width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", opacity: 1 - lift }}>
          <Eyebrow delay={8}>DreamDEX Event Contracts</Eyebrow>
        </div>
        <div style={{ transform: `scale(${interpolate(lift, [0, 1], [1, 0.62])})`, transformOrigin: "50% 0%", marginTop: 34 }}>
          <WordRise
            text="Will Bitcoin be higher, or lower?"
            delay={Q}
            style={{ fontSize: 118, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, maxWidth: 1500, margin: "0 auto" }}
            color={(w) => (w.startsWith("higher") ? C.ember : w.startsWith("lower") ? C.steelHot : undefined)}
          />
        </div>
      </div>

      {/* the two sides */}
      {(["up", "down"] as const).map((side) => {
        const x = COL_X[side];
        const col = side === "up" ? C.ember : C.steelHot;
        const count = side === "up" ? upCount : downCount;
        return (
          <div
            key={side}
            style={{
              position: "absolute",
              left: x - 230,
              top: 520,
              width: 460,
              height: 460,
              borderRadius: 28,
              border: `2px solid ${col}`,
              background: side === "up" ? "rgba(201,132,58,0.07)" : "rgba(111,160,191,0.07)",
              opacity: colIn,
              transform: `translateY(${(1 - colIn) * 40}px)`,
            }}
          >
            <div style={{ padding: "26px 32px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: 6, color: col }}>{side.toUpperCase()}</span>
              <span style={{ fontFamily: F.mono, fontSize: 30, color: C.chalk }}>{count}</span>
            </div>
          </div>
        );
      })}

      {/* the empty middle */}
      <div
        style={{
          position: "absolute",
          left: 960 - 150,
          top: 560,
          width: 300,
          height: 380,
          borderRadius: 24,
          border: `2px dashed rgba(239,230,214,${0.35 * fadeAt(frame, HOPE)})`,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          fontFamily: F.mono,
          fontSize: 24,
          lineHeight: 1.5,
          color: C.muted,
          opacity: fadeAt(frame, HOPE + 20),
        }}
      >
        <div>
          the other side
          <br />
          of the table:
          <br />
          <span style={{ color: C.chalk }}>empty</span>
        </div>
      </div>

      {/* the crowd */}
      {Array.from({ length: DOTS }).map((_, i) => {
        const side = random(`side${i}`) < 0.5 ? "up" : "down";
        const idx = side === "up" ? upIdx++ : downIdx++;
        const start = SPLIT + 30 + i * 4;
        const p = prog(frame, start, start + 40);
        if (frame < start) return null;
        const sx = 960 + (random(`sx${i}`) - 0.5) * 1700;
        const sy = 1140;
        const tx = COL_X[side] - 180 + (idx % 8) * 52;
        const ty = 640 + Math.floor(idx / 8) * 52;
        const x = interpolate(p, [0, 1], [sx, tx]);
        const y = interpolate(p, [0, 1], [sy, ty], clamp) - Math.sin(p * Math.PI) * 120;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 16,
              top: y - 16,
              width: 32,
              height: 32,
              borderRadius: 99,
              background: side === "up" ? C.ember : C.steelHot,
              opacity: 0.9,
              boxShadow: `0 0 18px ${side === "up" ? "rgba(232,160,96,0.6)" : "rgba(143,192,222,0.6)"}`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          bottom: 44,
          width: "100%",
          textAlign: "center",
          fontSize: 46,
          fontWeight: 700,
          opacity: fadeAt(frame, HOPE),
          transform: `translateY(${(1 - prog(frame, HOPE, HOPE + 30)) * 20}px)`,
        }}
      >
        Everyone picks a side. <span style={{ color: C.muted }}>Then hopes.</span>
      </div>
    </AbsoluteFill>
  );
};
