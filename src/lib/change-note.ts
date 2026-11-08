/** Direction of a change figure the database worked out. Display only: no arithmetic on money here. */
export type ChangeDirection = "up" | "down" | "flat";

export function changeDirection(value: number | string | null | undefined): ChangeDirection | null {
  if (value == null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n > 0 ? "up" : n < 0 ? "down" : "flat";
}

/** "6.0%" or "3.0 points" for a percentage-style change, without its sign (the arrow carries the direction). */
export function changeText(value: number | string | null | undefined, unit: "%" | " points"): string {
  const n = Number(value ?? 0);
  return `${Math.abs(n).toFixed(1)}${unit}`;
}
