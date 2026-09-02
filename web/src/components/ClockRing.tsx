"use client";

type Props = {
  remaining: number;
  duration: number;
};

export function ClockRing({ remaining, duration }: Props) {
  const t = duration <= 0 ? 0 : Math.max(0, Math.min(1, remaining / duration));
  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = Math.floor(Math.max(0, remaining) % 60);
  const label = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const locked = remaining <= 0;

  return (
    <div className="clock" style={{ ["--t" as string]: String(t) }}>
      <div className="clock-face">
        <span className="clock-kicker">{locked ? "locked" : "window"}</span>
        <span className="clock-time">{locked ? "00:00" : label}</span>
      </div>
    </div>
  );
}
