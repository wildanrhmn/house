import type { SVGProps } from "react";

export type MarkProps = SVGProps<SVGSVGElement> & { size?: number };

// A, The Pair: one coin in two halves, YES and NO. A complete set is the whole
// product, and it is already the chip that fires on the desk.
export function MarkPair({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden {...rest}>
      <path d="M15.2 3.2 A12.8 12.8 0 0 0 15.2 28.8 Z" />
      <path d="M16.8 3.2 A12.8 12.8 0 0 1 16.8 28.8 Z" opacity="0.45" />
      <circle cx="16" cy="16" r="14.6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

// B, Two Sides: an H built from a bid, an ask and the mid line between them.
// The letter is the quote.
export function MarkSides({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden {...rest}>
      <path d="M8 6 V26" strokeWidth="3.4" />
      <path d="M24 6 V26" strokeWidth="3.4" opacity="0.5" />
      <path d="M8 16 H24" strokeWidth="1.4" strokeDasharray="2 2.2" opacity="0.85" />
    </svg>
  );
}

// C, The Roof: a house gable with the mid bar inside. Literal and friendly.
export function MarkRoof({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" aria-hidden {...rest}>
      <path d="M5 14 L16 4.5 L27 14" strokeWidth="2.6" />
      <path d="M8 13 V27 H24 V13" strokeWidth="1.6" opacity="0.55" />
      <path d="M12 21 H20" strokeWidth="2.2" />
    </svg>
  );
}

// D, The Window: the desk's clock ring, three quarters run, a dot for now.
export function MarkWindow({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden {...rest}>
      <circle cx="16" cy="16" r="12.5" strokeWidth="1.2" opacity="0.3" />
      <path d="M16 3.5 A12.5 12.5 0 1 1 3.5 16" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const MARKS = [
  {
    id: "pair",
    label: "The Pair",
    sub: "One coin, two halves: YES and NO. A complete set is the whole idea, and it is already the chip that fires on the desk when both sides are taken.",
    Mark: MarkPair,
  },
  {
    id: "sides",
    label: "Two Sides",
    sub: "An H built from a bid, an ask and the dashed mid line between them. The letter is a two sided quote.",
    Mark: MarkSides,
  },
  {
    id: "roof",
    label: "The Roof",
    sub: "A house gable with the mid bar inside. Literal, friendly, and it reads at any size.",
    Mark: MarkRoof,
  },
  {
    id: "window",
    label: "The Window",
    sub: "The desk's clock ring, three quarters run, with a dot for now. Says fifteen minutes without a number.",
    Mark: MarkWindow,
  },
] as const;

export type MarkId = (typeof MARKS)[number]["id"];
