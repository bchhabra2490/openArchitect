import type { Brief, FloorPlan } from "./types";

export const GRID_SIZE = 0.5;
export const BLOCK_SIZES_M = [0.25, 0.5, 1] as const;
export const DEFAULT_PLOT = { width: 12, height: 10 };

export function nearestBlockSize(meters: number) {
  return BLOCK_SIZES_M.reduce((best, size) =>
    Math.abs(size - meters) < Math.abs(best - meters) ? size : best,
  );
}

export function isBlockLine(position: number, blockSize: number) {
  if (blockSize <= 0) return false;
  return Math.abs(position / blockSize - Math.round(position / blockSize)) < 0.001;
}

export function emptyPlan(): FloorPlan {
  return {
    units: "m",
    gridSize: GRID_SIZE,
    plot: { ...DEFAULT_PLOT },
    street: null,
    rooms: [],
    openings: [],
    furniture: [],
  };
}

export function normalizePlan(plan: FloorPlan): FloorPlan {
  return {
    units: "m",
    gridSize: plan.gridSize || GRID_SIZE,
    plot: { ...plan.plot },
    street: plan.street ? { ...plan.street } : null,
    rooms: plan.rooms.map((room) => ({ ...room })),
    openings: plan.openings.map((opening) => ({ ...opening })),
    furniture: plan.furniture.map((item) => ({ ...item })),
  };
}

export function emptyBrief(): Brief {
  return {
    description: "",
    notes: [],
    answers: {},
  };
}

export function snap(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}
