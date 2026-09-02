import { MarkPair } from "./logo/house-marks";

// The lockup used in the nav and on the desk. The Pair is the chosen mark;
// the 1024 submission asset lives in public/house-logo-1024.png and .svg.
export function HouseLogo({ size = 18 }: { size?: number }) {
  return (
    <span className="brand">
      <MarkPair size={size} />
      <b>HOUSE</b>
    </span>
  );
}
