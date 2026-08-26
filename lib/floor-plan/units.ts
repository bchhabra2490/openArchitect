export const DISPLAY_UNITS = ["m", "ft"] as const;
export type DisplayUnit = (typeof DISPLAY_UNITS)[number];

export const METERS_PER_FOOT = 0.3048;
export const FEET_PER_METER = 1 / METERS_PER_FOOT;
export const SCALE_BAR_METERS = 2;

export function isDisplayUnit(value: unknown): value is DisplayUnit {
  return value === "m" || value === "ft";
}

export function metersToDisplay(meters: number, unit: DisplayUnit) {
  return unit === "ft" ? meters * FEET_PER_METER : meters;
}

export function displayToMeters(value: number, unit: DisplayUnit) {
  return unit === "ft" ? value * METERS_PER_FOOT : value;
}

/** Preserve free-form sizes (any decimal); only clean float noise. */
export function preciseSize(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e8) / 1e8;
}

export function formatMeasure(meters: number, unit: DisplayUnit) {
  const value = metersToDisplay(meters, unit);
  if (!Number.isFinite(value)) return "0";
  // Keep typed precision (up to 8 dp); strip trailing zeros / float noise.
  const trimmed = String(parseFloat(value.toFixed(8)));
  return trimmed;
}

export function formatLength(meters: number, unit: DisplayUnit) {
  return `${formatMeasure(meters, unit)} ${unit}`;
}

export function formatSize(widthM: number, heightM: number, unit: DisplayUnit) {
  return `${formatMeasure(widthM, unit)}×${formatMeasure(heightM, unit)} ${unit}`;
}
