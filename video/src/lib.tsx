import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, F } from "./theme";

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// 0 to 1 between two frames, eased.
export const prog = (frame: number, from: number, to: number, easing = EASE) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing });

// Fade in at the start of a scene, out before its end, so crossfades stay clean.
export const useSceneFade = (dur: number, inLen = 14, outLen = 18) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, inLen, dur - outLen, dur], [0, 1, 1, 0], { ...clamp, easing: EASE });
};

export const fadeAt = (frame: number, inAt: number, outAt = 1e9, len = 14) =>
  interpolate(frame, [inAt, inAt + len, outAt - len, outAt], [0, 1, 1, 0], { ...clamp, easing: EASE });

export const useSpring = (delay: number, damping = 200, dur = 30) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 }, durationInFrames: dur });
};

export const FadeUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, y = 30, style }) => {
  const p = useSpring(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

// Words rise one by one, like the site's letter reveals.
export const WordRise: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  color?: (word: string, i: number) => string | undefined;
}> = ({ text, delay = 0, stagger = 4, style, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.28em", ...style }}>
      {text.split(" ").map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 200, mass: 0.7 }, durationInFrames: 26 });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em" }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 105}%)`,
                opacity: p,
                color: color?.(w, i),
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({
  children,
  delay = 0,
  color = C.ember,
}) => (
  <FadeUp delay={delay} y={16}>
    <div
      style={{
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: 7,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  </FadeUp>
);

// The Pair: one coin in two halves. split pushes the halves apart (px at size 100),
// fill 0..1 takes each half from outline to solid.
export const Pair: React.FC<{
  size?: number;
  split?: number;
  fillUp?: number;
  fillDown?: number;
  ring?: number;
  glow?: number;
}> = ({ size = 200, split = 0, fillUp = 1, fillDown = 1, ring = 1, glow = 0 }) => (
  <svg
    width={size}
    height={size}
    viewBox="-20 -20 140 140"
    style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 ${30 * glow}px rgba(232,160,96,${0.55 * glow}))` : undefined }}
  >
    <circle cx={50} cy={50} r={47} fill="none" stroke={C.tape} strokeOpacity={0.35 * ring} strokeWidth={1.4} strokeDasharray="2 5" />
    <g transform={`translate(${-split} 0)`}>
      <path
        d="M47.5 10 A40 40 0 0 0 47.5 90 Z"
        fill={C.copper}
        fillOpacity={0.08 + 0.92 * fillUp}
        stroke={C.ember}
        strokeWidth={1.4}
      />
    </g>
    <g transform={`translate(${split} 0)`}>
      <path
        d="M52.5 10 A40 40 0 0 1 52.5 90 Z"
        fill={C.steel}
        fillOpacity={0.08 + 0.92 * fillDown}
        stroke={C.steelHot}
        strokeWidth={1.4}
      />
    </g>
  </svg>
);

// A rounded chip: the takers and order tags.
export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: "up" | "down" | "plain" | "solid";
  style?: React.CSSProperties;
  big?: boolean;
}> = ({ children, tone = "plain", style, big }) => {
  const border = tone === "up" ? C.ember : tone === "down" ? C.steelHot : C.line2;
  const bg = tone === "solid" ? C.tape : "rgba(22,19,42,0.94)";
  const color = tone === "solid" ? C.ink : C.chalk;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: big ? "18px 30px" : "12px 22px",
        borderRadius: 999,
        border: `2px solid ${border}`,
        background: bg,
        color,
        fontFamily: F.mono,
        fontSize: big ? 34 : 26,
        whiteSpace: "nowrap",
        boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
        ...style,
      }}
    >
      {tone === "up" || tone === "down" ? (
        <span style={{ width: 12, height: 12, borderRadius: 99, background: tone === "up" ? C.ember : C.steelHot }} />
      ) : null}
      {children}
    </div>
  );
};

// Night pit backdrop: deep ink, two slow drifting glows, faint grid, vignette.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const a = frame / 240;
  const x1 = 32 + Math.sin(a) * 6;
  const y1 = 30 + Math.cos(a * 0.8) * 5;
  const x2 = 70 + Math.cos(a * 0.9) * 6;
  const y2 = 72 + Math.sin(a * 0.7) * 5;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 45% at ${x1}% ${y1}%, rgba(201,132,58,0.16), transparent 70%),
            radial-gradient(40% 45% at ${x2}% ${y2}%, rgba(61,106,134,0.20), transparent 70%),
            radial-gradient(ellipse 80% 50% at 50% -10%, #2a2248 0%, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(239,230,214,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(239,230,214,0.035) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

export const BrowserFrame: React.FC<{ url: string; children: React.ReactNode; width: number }> = ({
  url,
  children,
  width,
}) => (
  <div
    style={{
      width,
      borderRadius: 18,
      overflow: "hidden",
      background: C.pit,
      border: `1px solid ${C.line2}`,
      boxShadow: "0 70px 160px -40px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 20px",
        background: "rgba(255,255,255,0.035)",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div style={{ display: "flex", gap: 9 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          fontFamily: F.mono,
          fontSize: 20,
          color: C.muted,
          background: "rgba(0,0,0,0.35)",
          borderRadius: 9,
          padding: "8px 16px",
        }}
      >
        {url}
      </div>
    </div>
    <div style={{ position: "relative" }}>{children}</div>
  </div>
);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
