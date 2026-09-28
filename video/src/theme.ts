import { loadFont as loadSyne } from "@remotion/google-fonts/Syne";
import { loadFont as loadPlex } from "@remotion/google-fonts/IBMPlexMono";

// Same type and palette as bethebook.xyz.
const syne = loadSyne("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const plex = loadPlex("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const F = {
  display: syne.fontFamily,
  mono: plex.fontFamily,
};

export const C = {
  bg: "#0c0a1a",
  pit: "#110f22",
  ink: "#16132a",
  tape: "#efe6d6",
  chalk: "#f3eadc",
  muted: "#8d8474",
  faint: "#5b5566",
  copper: "#c9843a",
  ember: "#e8a060",
  steel: "#6fa0bf",
  steelHot: "#8fc0de",
  warn: "#c45c3a",
  good: "#8fd19e",
  line: "rgba(239,230,214,0.10)",
  line2: "rgba(239,230,214,0.18)",
  card: "rgba(26,22,48,0.72)",
};

export const FPS = 60;
export const sec = (s: number) => Math.round(s * FPS);
