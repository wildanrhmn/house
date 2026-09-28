import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Eyebrow, WordRise, prog, useSceneFade, useSpring } from "../lib";

const VO = 20;
const at = (s: number) => VO + Math.round(s * 60);
const GRID = at(1.3);
const BOTS = at(4.7);

const ASSETS = ["BTC", "ETH"];
const WINDOWS = ["5m", "15m", "1h", "4h", "1d"];

// Real fills where a wallet we don't own crossed a HOUSE quote on Shannon.
const FILLS = [
  { who: "0x436f…2bc3", kind: "MINT_A_PAIR", mkt: "BTC 1h", px: "0.409" },
  { who: "0x6774…8461", kind: "MINT_A_PAIR", mkt: "BTC 15m", px: "0.518" },
  { who: "0x204f…d3d2", kind: "took UP", mkt: "BTC 15m", px: "0.756" },
  { who: "0xd351…0f39", kind: "MINT_A_PAIR", mkt: "BTC 15m", px: "0.630" },
  { who: "0xeb94…e157", kind: "MINT_A_PAIR", mkt: "BTC 15m", px: "0.492" },
];

export const Proof: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(dur);
  const slide = prog(frame, BOTS - 6, BOTS + 34);
  const panelIn = useSpring(BOTS + 6);

  return (
    <AbsoluteFill style={{ opacity: fade, fontFamily: F.display, color: C.tape }}>
      <div style={{ position: "absolute", top: 90, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Eyebrow delay={4}>Live on Somnia testnet</Eyebrow>
        </div>
        <WordRise text="And it is live." delay={10} style={{ marginTop: 22, fontSize: 96, fontWeight: 800, letterSpacing: -2 }} />
      </div>

      {/* all ten markets */}
      <div
        style={{
          position: "absolute",
          top: 380,
          left: interpolate(slide, [0, 1], [960 - 520, 120]),
          width: 1040,
          transform: `scale(${interpolate(slide, [0, 1], [1, 0.72])})`,
          transformOrigin: "0% 0%",
        }}
      >
        {ASSETS.map((a, r) => (
          <div key={a} style={{ display: "flex", gap: 18, marginBottom: 18 }}>
            {WINDOWS.map((w, c) => {
              const i = r * 5 + c;
              const on = prog(frame, GRID + i * 7, GRID + i * 7 + 18);
              const up = r === 0;
              return (
                <div
                  key={w}
                  style={{
                    width: 190,
                    height: 150,
                    borderRadius: 20,
                    border: `2px solid ${up ? `rgba(232,160,96,${0.2 + 0.8 * on})` : `rgba(143,192,222,${0.2 + 0.8 * on})`}`,
                    background: `rgba(${up ? "201,132,58" : "111,160,191"},${0.04 + 0.12 * on})`,
                    boxShadow: on > 0.5 ? `0 0 34px -8px ${up ? C.ember : C.steelHot}` : "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: 0.35 + 0.65 * on,
                    transform: `translateY(${(1 - on) * 14}px)`,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 36, color: up ? C.ember : C.steelHot }}>{a}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 30, marginTop: 6 }}>{w}</div>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 30, color: C.muted, textAlign: "center", opacity: prog(frame, GRID + 80, GRID + 100) }}>
          all ten DreamDEX markets
        </div>
      </div>

      {/* strangers taking HOUSE quotes */}
      <div
        style={{
          position: "absolute",
          left: 930,
          top: 360,
          width: 870,
          opacity: panelIn,
          transform: `translateX(${(1 - panelIn) * 80}px)`,
        }}
      >
        <div style={{ fontFamily: F.mono, fontSize: 26, color: C.muted, marginBottom: 18 }}>
          wallets we don't own, crossing HOUSE quotes
        </div>
        {FILLS.map((f, i) => {
          const p = prog(frame, BOTS + 20 + i * 20, BOTS + 44 + i * 20);
          return (
            <div
              key={f.who}
              style={{
                display: "grid",
                gridTemplateColumns: "230px 230px 150px 1fr",
                alignItems: "center",
                gap: 12,
                padding: "18px 24px",
                marginBottom: 12,
                borderRadius: 16,
                background: C.card,
                border: `1px solid ${C.line2}`,
                fontFamily: F.mono,
                fontSize: 26,
                opacity: p,
                transform: `translateY(${(1 - p) * 24}px)`,
              }}
            >
              <span style={{ color: C.chalk }}>{f.who}</span>
              <span style={{ color: f.kind === "took UP" ? C.ember : C.steelHot }}>{f.kind}</span>
              <span style={{ color: C.muted }}>{f.mkt}</span>
              <span style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontFamily: F.display,
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: 2,
                    padding: "6px 12px",
                    borderRadius: 99,
                    background: C.tape,
                    color: C.ink,
                  }}
                >
                  NOT OURS
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
