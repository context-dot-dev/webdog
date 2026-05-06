/** Stored on targets as hours (fractional allowed); worker eligibility uses this spacing. */
export const CHECK_FREQUENCY_PRESET_HOURS = [0.25, 0.5, 1, 6, 12, 24, 48, 168] as const;

export function checkFrequencyLabel(hours: number): string {
  const mins = Math.round(hours * 60);
  if (mins === 15) return "Every 15 minutes";
  if (mins === 30) return "Every 30 minutes";
  if (mins === 60) return "Every hour";
  if (mins === 10080) return "1 week";
  if (mins > 60 && mins % 60 === 0) return `Every ${mins / 60} hours`;
  return `Every ${mins} minutes`;
}
