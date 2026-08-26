export type FurniturePreset = {
  kind: string;
  name: string;
  width: number;
  height: number;
};

export const FURNITURE_CATALOG: FurniturePreset[] = [
  { kind: "bed", name: "Bed", width: 2, height: 1.5 },
  { kind: "sofa", name: "Sofa", width: 2, height: 0.9 },
  { kind: "table", name: "Table", width: 1.5, height: 0.9 },
  { kind: "desk", name: "Desk", width: 1.2, height: 0.6 },
  { kind: "wardrobe", name: "Wardrobe", width: 1.2, height: 0.6 },
  { kind: "counter", name: "Counter", width: 2, height: 0.6 },
  { kind: "stove", name: "Stove", width: 0.6, height: 0.6 },
  { kind: "sink", name: "Sink", width: 0.6, height: 0.5 },
  { kind: "fridge", name: "Fridge", width: 0.6, height: 0.6 },
  { kind: "toilet", name: "WC", width: 0.4, height: 0.7 },
  { kind: "chair", name: "Chair", width: 0.5, height: 0.5 },
];

export function furniturePreset(kind: string): FurniturePreset {
  return (
    FURNITURE_CATALOG.find((item) => item.kind === kind) ?? {
      kind,
      name: kind,
      width: 1,
      height: 1,
    }
  );
}
