export type DisplayLayers = {
  roomColors: boolean;
  doors: boolean;
  objects: boolean;
};

export const DEFAULT_DISPLAY_LAYERS: DisplayLayers = {
  roomColors: true,
  doors: true,
  objects: true,
};

export function isDisplayLayers(value: unknown): value is DisplayLayers {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.roomColors === "boolean" &&
    typeof record.doors === "boolean" &&
    typeof record.objects === "boolean"
  );
}
