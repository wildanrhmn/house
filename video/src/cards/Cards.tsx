import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, F } from "../theme";
import { Background, BrowserFrame, Chip, Pair } from "../lib";
import { Half } from "../scenes/Rule";

// Static 1920x1080 cards for an X post. No springs: every element is at rest.

const Frame: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <AbsoluteFill style={{ fontFamily: F.display, color: C.tape }}>
    <Background />
    <div style={{ position: "absolute", left: 80, top: 64, display: "flex", alignItems: "center", gap: 16 }}>
      <Pair size={46} ring={0} />
      <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: 8 }}>HOUSE</span>
    </div>
    <div style={{ position: "absolute", right: 80, top: 72, fontFamily: F.mono, fontSize: 26, color: C.muted }}>{n} / 4</div>
    <div style={{ position: "absolute", left: 80, bottom: 60, fontFamily: F.mono, fontSize: 26, color: C.muted }}>bethebook.xyz</div>
    <div style={{ position: "absolute", right: 80, bottom: 60, fontFamily: F.mono, fontSize: 22, color: C.faint }}>
      Somnia x DreamDEX Event Contracts
    </div>
    {children}
  </AbsoluteFill>
);

const Title: React.FC<{ children: React.ReactNode; sub?: string; top?: number; size?: number }> = ({ children, sub, top = 170, size = 96 }) => (
  <div style={{ position: "absolute", top, width: "100%", textAlign: "center" }}>
    <div style={{ fontSize: size, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{children}</div>
    {sub ? (
      <div style={{ margin: "26px auto 0", maxWidth: 1300, fontFamily: F.mono, fontSize: 32, lineHeight: 1.5, color: C.chalk }}>{sub}</div>
    ) : null}
  </div>
);

const Dots: React.FC<{ color: string; n: number }> = ({ color, n }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 18, padding: "10px 30px" }}>
    {Array.from({ length: n }).map((_, i) => (
      <span key={i} style={{ width: 30, height: 30, borderRadius: 99, background: color, boxShadow: `0 0 16px ${color}` }} />
    ))}
  </div>
);

export const Card1: React.FC = () => (
  <Frame n={1}>
    <Title sub="On DreamDEX Event Contracts, traders bet Bitcoin Up or Down. Almost nobody posts prices on the other side.">
      Everyone picks a side.
    </Title>
    <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
      {(["up", "down"] as const).map((side, i) => {
        const col = side === "up" ? C.ember : C.steelHot;
        const box = (
          <div
            key={side}
            style={{
              width: 520,
              height: 380,
              borderRadius: 28,
              border: `2px solid ${col}`,
              background: side === "up" ? "rgba(201,132,58,0.08)" : "rgba(111,160,191,0.08)",
            }}
          >
            <div style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: 6, color: col }}>{side.toUpperCase()}</span>
              <span style={{ fontFamily: F.mono, fontSize: 30 }}>{side === "up" ? 21 : 18}</span>
            </div>
            <Dots color={col} n={side === "up" ? 21 : 18} />
          </div>
        );
        return i === 0 ? (
          <React.Fragment key="row">
            {box}
            <div
              style={{
                width: 300,
                height: 380,
                borderRadius: 24,
                border: "2px dashed rgba(239,230,214,0.35)",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                fontFamily: F.mono,
                fontSize: 28,
                lineHeight: 1.5,
                color: C.muted,
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
          </React.Fragment>
        ) : (
          box
        );
      })}
    </div>
  </Frame>
);

export const Card2: React.FC = () => (
  <Frame n={2}>
    <Title sub="When one trader buys Up and another buys Down, nobody has to sell. The pool mints a brand new pair.">
      The rule most people miss.
    </Title>
    <div style={{ position: "absolute", top: 560, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 30, fontSize: 80, fontWeight: 800 }}>
      <Half side="up" size={130} />
      <span style={{ color: C.ember }}>UP</span>
      <span style={{ color: C.muted }}>+</span>
      <Half side="down" size={130} />
      <span style={{ color: C.steelHot }}>DOWN</span>
      <span style={{ color: C.muted }}>=</span>
      <span style={{ fontFamily: F.mono, fontWeight: 500 }}>1.00</span>
    </div>
    <div style={{ position: "absolute", top: 760, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
      {[
        { k: "Bitcoin ends up", v: "1.00 + 0.00" },
        { k: "Bitcoin ends down", v: "0.00 + 1.00" },
      ].map((r) => (
        <div key={r.k} style={{ padding: "22px 34px", borderRadius: 18, background: C.card, border: `1px solid ${C.line2}`, fontFamily: F.mono, fontSize: 30 }}>
          <span style={{ color: C.muted }}>{r.k}: </span>
          {r.v} <span style={{ color: C.ember }}>= 1.00</span>
        </div>
      ))}
    </div>
  </Frame>
);

const Order: React.FC<{ side: "up" | "down" }> = ({ side }) => {
  const col = side === "up" ? C.ember : C.steelHot;
  return (
    <div
      style={{
        width: 420,
        padding: "28px 32px",
        borderRadius: 24,
        border: `2px solid ${col}`,
        background: side === "up" ? "rgba(201,132,58,0.16)" : "rgba(111,160,191,0.16)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 36, letterSpacing: 3, color: col }}>{side.toUpperCase()}</span>
        <span style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 2, padding: "6px 14px", borderRadius: 99, background: C.tape, color: C.ink }}>
          TAKEN
        </span>
      </div>
      <div style={{ marginTop: 14, fontFamily: F.mono, fontSize: 70, fontWeight: 500 }}>0.49</div>
      <div style={{ fontFamily: F.mono, fontSize: 24, color: C.muted }}>you pay</div>
    </div>
  );
};

export const Card3: React.FC = () => (
  <Frame n={3}>
    <Title top={160} size={80}>HOUSE sits on both sides.</Title>
    <div style={{ position: "absolute", top: 330, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 70 }}>
      <Order side="up" />
      <div style={{ position: "relative", width: 300, height: 300, display: "grid", placeItems: "center" }}>
        <Pair size={300} glow={1} />
        <div style={{ position: "absolute", fontFamily: F.mono, fontWeight: 500, fontSize: 44, color: C.tape, background: "rgba(12,10,26,0.88)", padding: "6px 18px", borderRadius: 14, border: `1px solid ${C.line2}` }}>1.00</div>
      </div>
      <Order side="down" />
    </div>
    <div style={{ position: "absolute", top: 730, width: "100%", display: "flex", justifyContent: "center", gap: 90, textAlign: "center" }}>
      {[
        { v: "0.98", k: "A PAIR COSTS YOU" },
        { v: "1.00", k: "A PAIR PAYS" },
        { v: "+0.02", k: "YOU KEEP", hot: true },
      ].map((s) => (
        <div key={s.k}>
          <div style={{ fontFamily: F.mono, fontSize: 76, fontWeight: 500, color: s.hot ? C.ember : C.tape }}>{s.v}</div>
          <div style={{ marginTop: 6, fontFamily: F.mono, fontSize: 22, letterSpacing: 4, color: C.muted }}>{s.k}</div>
        </div>
      ))}
    </div>
  </Frame>
);

export const Card4: React.FC = () => (
  <Frame n={4}>
    <div style={{ position: "absolute", left: 80, top: 190, width: 600 }}>
      <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>Real, on Somnia testnet.</div>
      <div style={{ marginTop: 34, fontFamily: F.mono, fontSize: 30, lineHeight: 1.55, color: C.chalk }}>
        One quote, both sides taken, cashed out.
      </div>
      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
        <Chip tone="up">+0.105 kept on 5 pairs</Chip>
        <Chip tone="down">strangers took quotes, unasked</Chip>
        <Chip tone="plain">all 10 DreamDEX markets</Chip>
      </div>
    </div>
    <div style={{ position: "absolute", right: 70, top: 210, transform: "rotate(-1.5deg)" }}>
      <BrowserFrame url="bethebook.xyz/desk" width={1080}>
        <Img src={staticFile("img/desk-2-taken.png")} style={{ width: 1080, display: "block" }} />
      </BrowserFrame>
    </div>
  </Frame>
);
