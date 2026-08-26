import type { Brief, FloorPlan } from "./types";

function briefText(brief: Brief) {
  return [brief.description, ...brief.notes, ...Object.values(brief.answers)]
    .join(" ")
    .toLowerCase();
}

export function briefOmitsStairs(brief: Brief) {
  return /no stairs|without stairs|don't (need|want) stairs|do not (need|want) stairs|no staircase|without a staircase/.test(
    briefText(brief),
  );
}

export function briefOmitsPorch(brief: Brief) {
  return /no porch|without porch|no verandah|no veranda|no portico|don't (need|want) (a )?(porch|verandah|veranda)|do not (need|want) (a )?(porch|verandah|veranda)/.test(
    briefText(brief),
  );
}

export function briefOmitsStreet(brief: Brief) {
  return /no street|without (a )?street|internal (plot|unit)|no (frontage|road)/.test(
    briefText(brief),
  );
}

export function hasStairsRoom(plan: FloorPlan) {
  return plan.rooms.some(
    (room) => room.type === "stairs" || /stair/i.test(room.name),
  );
}

export function hasPorchRoom(plan: FloorPlan) {
  return plan.rooms.some(
    (room) => room.type === "porch" || /porch|verandah|veranda|portico/i.test(room.name),
  );
}

export function briefFrontageText(brief: Brief) {
  return briefText(brief);
}
