"use client";

type Props = {
  up: number;
  down: number;
  bidYes: number | null;
  askYes: number | null;
};

export function QuoteBeam({ up, down, bidYes, askYes }: Props) {
  const total = up + down;
  const tilt = total <= 0 ? 0 : ((up - down) / total) * 14;

  return (
    <div className="beam">
      <div className="beam-arm" style={{ transform: `rotate(${tilt}deg)` }}>
        <div className="pan pan-up">
          <span className="pan-side">Up</span>
          <span className="pan-px">{bidYes == null ? "-" : bidYes.toFixed(3)}</span>
          <span className="pan-inv">{fmt(up)} long</span>
        </div>
        <div className="beam-bar" />
        <div className="pan pan-down">
          <span className="pan-side">Down</span>
          <span className="pan-px">{askYes == null ? "-" : (1 - askYes).toFixed(3)}</span>
          <span className="pan-inv">{fmt(down)} long</span>
        </div>
      </div>
      <p className="beam-note">Buy Up + Buy Down. Takers mint the pair. You keep the spread.</p>
    </div>
  );
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
