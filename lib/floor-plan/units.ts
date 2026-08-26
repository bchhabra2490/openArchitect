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

export function formatMeasure(meters: number, unit: DisplayUnit) {
  const value = metersToDisplay(meters, unit);
  const rounded = unit === "ft" ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return unit === "ft" ? rounded.toFixed(1) : String(rounded);
}

export function formatLength(meters: number, unit: DisplayUnit) {
  return `${formatMeasure(meters, unit)} ${unit}`;
}

export function formatSize(widthM: number, heightM: number, unit: DisplayUnit) {
  return `${formatMeasure(widthM, unit)}×${formatMeasure(heightM, unit)} ${unit}`;
}
