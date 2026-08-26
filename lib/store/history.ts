import { emptyBrief, normalizePlan } from "@/lib/floor-plan/defaults";
import type { Brief, FloorPlan, StudioClipboard } from "@/lib/floor-plan/types";

export const MAX_HISTORY = 40;
const COALESCE_MS = 700;

export type HistorySnapshot = {
  brief: Brief;
  plan: FloorPlan;
  selectedRoomId: string | null;
  selectedFurnitureId: string | null;
  selectedOpeningId: string | null;
};

export type HistoryFields = Pick<
  HistorySnapshot,
  "brief" | "plan" | "selectedRoomId" | "selectedFurnitureId" | "selectedOpeningId"
>;

let lastPushAt = 0;

export function resetHistoryClock() {
  lastPushAt = 0;
}

function cloneBrief(brief: Brief): Brief {
  return {
    ...brief,
    notes: [...brief.notes],
    answers: { ...brief.answers },
  };
}

export function captureHistory(state: HistoryFields): HistorySnapshot {
  return {
    brief: cloneBrief(state.brief),
    plan: normalizePlan(state.plan),
    selectedRoomId: state.selectedRoomId,
    selectedFurnitureId: state.selectedFurnitureId,
    selectedOpeningId: state.selectedOpeningId,
  };
}

function trimPast(past: HistorySnapshot[]) {
  return past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
}

export function pushHistory(
  past: HistorySnapshot[],
  current: HistorySnapshot,
  coalesce: boolean,
): { past: HistorySnapshot[]; future: HistorySnapshot[] } {
  const now = Date.now();
  if (coalesce && past.length > 0 && now - lastPushAt < COALESCE_MS) {
    lastPushAt = now;
    return { past, future: [] };
  }
  lastPushAt = now;
  return { past: trimPast([...past, current]), future: [] };
}

export function cloneClipboard(clipboard: StudioClipboard | null): StudioClipboard | null {
  if (!clipboard || typeof clipboard !== "object" || !("type" in clipboard)) return null;
  if (clipboard.type === "furniture" && clipboard.item) {
    return { type: "furniture", item: { ...clipboard.item } };
  }
  if (clipboard.type === "opening" && clipboard.opening) {
    return { type: "opening", opening: { ...clipboard.opening } };
  }
  if (clipboard.type === "room" && clipboard.room) {
    return {
      type: "room",
      room: { ...clipboard.room },
      openings: (clipboard.openings ?? []).map((opening) => ({ ...opening })),
      furniture: (clipboard.furniture ?? []).map((item) => ({ ...item })),
    };
  }
  return null;
}

export function restoreHistory(snapshot: HistorySnapshot): HistoryFields {
  return {
    brief: cloneBrief(snapshot.brief),
    plan: normalizePlan(snapshot.plan),
    selectedRoomId: snapshot.selectedRoomId,
    selectedFurnitureId: snapshot.selectedFurnitureId,
    selectedOpeningId: snapshot.selectedOpeningId,
  };
}

export function normalizeHistoryList(value: unknown): HistorySnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<HistorySnapshot>;
    if (!row.plan || !row.brief) return [];
    return [
      {
        brief: row.brief ?? emptyBrief(),
        plan: normalizePlan(row.plan),
        selectedRoomId: row.selectedRoomId ?? null,
        selectedFurnitureId: row.selectedFurnitureId ?? null,
        selectedOpeningId: row.selectedOpeningId ?? null,
      },
    ];
  });
}

export function plansMatch(a: FloorPlan, b: FloorPlan) {
  return JSON.stringify(a) === JSON.stringify(b);
}
