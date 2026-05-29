/** Normalize DB/RSC timestamp values (epoch ms, Date, or ISO string) to Date. */
export function parseTimestamp(value: Date | string | number | null | undefined): Date {
  if (value == null) return new Date(Number.NaN);
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (/^\d+$/.test(value)) return new Date(Number(value));
  return new Date(value);
}
