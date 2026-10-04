import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";

// X profile picture, cropped to a circle. The mark stays well inside it.
export const Avatar: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(60% 60% at 34% 38%, rgba(201,132,58,0.32), transparent 70%),
        radial-gradient(60% 60% at 68% 66%, rgba(61,106,134,0.38), transparent 70%),
        ${C.bg}`,
      display: "grid",
      placeItems: "center",
    }}
  >
    <svg width={500} height={500} viewBox="0 0 100 100" style={{ overflow: "visible", filter: "drop-shadow(0 0 22px rgba(232,160,96,0.45))" }}>
      <circle cx={50} cy={50} r={47} fill="none" stroke={C.tape} strokeOpacity={0.4} strokeWidth={1.1} strokeDasharray="1.6 3.4" />
      <path d="M47.6 10 A40 40 0 0 0 47.6 90 Z" fill={C.copper} stroke={C.ember} strokeWidth={1.2} />
      <path d="M52.4 10 A40 40 0 0 1 52.4 90 Z" fill={C.steel} stroke={C.steelHot} strokeWidth={1.2} />
    </svg>
  </AbsoluteFill>
);
