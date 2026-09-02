import { MarkPair } from "./logo/house-marks";

// The lockup used in the nav and on the desk. Swap the mark here once picked.
export function HouseLogo({ size = 18 }: { size?: number }) {
  return (
    <span className="brand">
      <MarkPair size={size} />
      <b>HOUSE</b>
    </span>
  );
}
