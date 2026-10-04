import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F } from "../theme";
import { Background, Pair } from "../lib";

// X header, 1500x500. The avatar sits over the bottom left, so content stays
// centred and right of it.

const BIDS = [0.62, 0.48, 0.36, 0.26];
const ASKS = [0.58, 0.44, 0.32, 0.22];

const Bar: React.FC<{ w: number; color: string; house?: boolean; align: "left" | "right" }> = ({ w, color, house, align }) => (
  <div style={{ display: "flex", justifyContent: align === "left" ? "flex-end" : "flex-start", height: 16 }}>
    <div
      style={{
        width: `${w * 100}%`,
        height: 16,
        borderRadius: 4,
        background: house ? color : `${color}40`,
        boxShadow: house ? `0 0 18px ${color}` : "none",
      }}
    />
  </div>
);

export const Cover: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: F.display, color: C.tape }}>
    <Background />

    {/* a quiet order book on the right, HOUSE rows lit */}
    <div style={{ position: "absolute", right: 60, top: 110, width: 330, display: "flex", gap: 14, opacity: 0.95 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <Bar w={0.8} color={C.ember} house align="left" />
        {BIDS.map((w) => (
          <Bar key={w} w={w} color={C.ember} align="left" />
        ))}
      </div>
      <div style={{ width: 1, background: C.line2 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <Bar w={0.8} color={C.steelHot} house align="right" />
        {ASKS.map((w) => (
          <Bar key={w} w={w} color={C.steelHot} align="right" />
        ))}
      </div>
    </div>
    <div style={{ position: "absolute", right: 60, top: 270, width: 330, display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 17, color: C.muted }}>
      <span>
        buy UP <span style={{ color: C.ember }}>0.49</span>
      </span>
      <span>
        buy DOWN <span style={{ color: C.steelHot }}>0.49</span>
      </span>
    </div>
    <div style={{ position: "absolute", right: 60, top: 304, width: 330, textAlign: "center", fontFamily: F.mono, fontSize: 17, color: C.chalk }}>
      a pair pays 1.00, you keep <span style={{ color: C.ember }}>+0.02</span>
    </div>

    {/* centre: mark and line */}
    <div style={{ position: "absolute", left: 300, top: 120, display: "flex", alignItems: "center", gap: 28 }}>
      <Pair size={130} glow={0.8} />
      <div>
        <div style={{ fontWeight: 800, fontSize: 70, letterSpacing: -1, lineHeight: 1 }}>Be the book.</div>
        <div style={{ marginTop: 16, fontFamily: F.mono, fontSize: 20, color: C.chalk, lineHeight: 1.45 }}>
          Quote both sides of DreamDEX Event Contracts
          <br />
          from a normal wallet.
        </div>
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        right: 70,
        bottom: 42,
        display: "flex",
        gap: 26,
        alignItems: "center",
        fontFamily: F.mono,
        fontSize: 22,
      }}
    >
      <span style={{ color: C.muted }}>Built on Somnia for DreamDEX</span>
      <span style={{ color: C.tape, padding: "8px 18px", borderRadius: 999, border: `1px solid ${C.line2}`, background: "rgba(22,19,42,0.8)" }}>
        bethebook.xyz
      </span>
    </div>
  </AbsoluteFill>
);
