import { MarkPair } from "./logo/house-marks";

export function HouseLogo({ size = 18 }: { size?: number }) {
  return (
    <span className="brand">
      <MarkPair size={size} />
      <b>HOUSE</b>
    </span>
  );
}
