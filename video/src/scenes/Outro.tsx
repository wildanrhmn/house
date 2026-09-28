import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { FadeUp, Pair, prog, useSpring } from "../lib";

const VO = 20;
const at = (s: number) => VO + Math.round(s * 60);
const DEEPER = at(2.0);
const LOGO = at(4.4);

// A small order book: crowd levels, then HOUSE rows slotting in and depth growing.
const BIDS = [0.46, 0.44, 0.42, 0.4];
const ASKS = [0.54, 0.56, 0.58, 0.6];

const Row: React.FC<{ px: number; side: "bid" | "ask"; w: number; house?: boolean; show: number }> = ({ px, side, w, house, show }) => {
  const col = side === "bid" ? C.ember : C.steelHot;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, height: 44, opacity: show }}>
      <span style={{ width: 90, fontFamily: F.mono, fontSize: 24, color: house ? C.tape : C.muted }}>{px.toFixed(2)}</span>
      <div style={{ flex: 1, height: 26, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${w * 100}%`,
            borderRadius: 6,
            background: house ? col : `${col}55`,
            boxShadow: house ? `0 0 24px ${col}` : "none",
          }}
        />
      </div>
      <span style={{ width: 110, fontFamily: F.display, fontWeight: 700, fontSize: 18, letterSpacing: 3, color: house ? C.tape : "transparent" }}>
        HOUSE
      </span>
    </div>
  );
};

export const Outro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const bookOut = prog(frame, LOGO - 16, LOGO + 8);
  const houseRows = prog(frame, DEEPER, DEEPER + 40);
  const grow = prog(frame, DEEPER + 20, DEEPER + 90);
  const logo = useSpring(LOGO, 14, 50);
  const end = interpolate(frame, [dur - 30, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily: F.display, color: C.tape, opacity: end }}>
      <div style={{ position: "absolute", left: 310, top: 150, width: 1300, opacity: prog(frame, 0, 18) * (1 - bookOut) }}>
        <div style={{ fontSize: 60, fontWeight: 800, textAlign: "center", marginBottom: 44, whiteSpace: "nowrap" }}>
          {frame < DEEPER ? "DreamDEX books are thin." : "Every HOUSE quote makes them deeper."}
        </div>
        {ASKS.slice()
          .reverse()
          .map((px, i) => (
            <Row key={px} px={px} side="ask" w={(0.12 + 0.04 * i) * (1 + 1.6 * grow)} show={1} />
          ))}
        <Row px={0.52} side="ask" w={0.55 * houseRows} house show={houseRows} />
        <div style={{ height: 1, background: C.line2, margin: "10px 0" }} />
        <Row px={0.48} side="bid" w={0.55 * houseRows} house show={houseRows} />
        {BIDS.map((px, i) => (
          <Row key={px} px={px} side="bid" w={(0.24 - 0.04 * i) * (1 + 1.6 * grow)} show={1} />
        ))}
      </div>

      <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: logo }}>
        <div style={{ textAlign: "center", transform: `scale(${0.85 + 0.15 * logo})` }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Pair size={260} split={interpolate(logo, [0, 1], [30, 0])} glow={logo} />
          </div>
          <div style={{ marginTop: 10, fontWeight: 800, fontSize: 120, letterSpacing: 26 }}>HOUSE</div>
          <FadeUp delay={LOGO + 30}>
            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 56, color: C.ember }}>Be the book.</div>
          </FadeUp>
          <FadeUp delay={LOGO + 70}>
            <div style={{ marginTop: 34, fontFamily: F.mono, fontSize: 40, color: C.chalk }}>bethebook.xyz</div>
          </FadeUp>
          <FadeUp delay={LOGO + 100}>
            <div style={{ marginTop: 26, fontFamily: F.mono, fontSize: 24, color: C.muted }}>
              Built on Somnia for DreamDEX Event Contracts
            </div>
          </FadeUp>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
