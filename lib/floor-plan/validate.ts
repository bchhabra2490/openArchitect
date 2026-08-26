import { checkDesignRules } from "./design-rules";
import { furnitureFitsInRoom, roomsOverlap } from "./geometry";
import type {
  Brief,
  FloorPlan,
  FurnitureItem,
  Opening,
  Room,
  ValidationIssue,
} from "./types";

const EPS = 0.01;

function edgeLength(room: Room, edge: Opening["edge"]): number {
  return edge === "north" || edge === "south" ? room.width : room.height;
}

function roomOutsidePlot(room: Room, plot: FloorPlan["plot"]): boolean {
  return (
    room.x < -EPS ||
    room.y < -EPS ||
    room.x + room.width > plot.width + EPS ||
    room.y + room.height > plot.height + EPS
  );
}

export function validatePlan(plan: FloorPlan, brief?: Brief): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roomsById = new Map(plan.rooms.map((room) => [room.id, room]));

  if (plan.plot.width <= 0 || plan.plot.height <= 0) {
    issues.push({
      severity: "error",
      code: "plot_invalid",
      message: "Plot width and height must be positive.",
    });
  }

  for (const room of plan.rooms) {
    if (roomOutsidePlot(room, plan.plot)) {
      issues.push({
        severity: "error",
        code: "room_outside_plot",
        entityId: room.id,
        message: `${room.name} (${room.id}) extends outside the ${plan.plot.width}×${plan.plot.height} m plot.`,
      });
    }
  }

  for (let i = 0; i < plan.rooms.length; i += 1) {
    for (let j = i + 1; j < plan.rooms.length; j += 1) {
      const a = plan.rooms[i];
      const b = plan.rooms[j];
      if (roomsOverlap(a, b)) {
        issues.push({
          severity: "error",
          code: "room_overlap",
          entityId: a.id,
          message: `${a.name} overlaps ${b.name}.`,
        });
      }
    }
  }

  for (const opening of plan.openings) {
    const room = roomsById.get(opening.roomId);
    if (!room) {
      issues.push({
        severity: "error",
        code: "opening_missing_room",
        entityId: opening.id,
        message: `${opening.kind} ${opening.id} references unknown room ${opening.roomId}.`,
      });
      continue;
    }
    const length = edgeLength(room, opening.edge);
    if (opening.offset < -EPS || opening.offset + opening.width > length + EPS) {
      issues.push({
        severity: "error",
        code: "opening_off_edge",
        entityId: opening.id,
        message: `${opening.kind} on ${room.name} ${opening.edge} wall does not fit the ${length} m edge.`,
      });
    }
  }

  for (const item of plan.furniture) {
    const room = roomsById.get(item.roomId);
    if (!room) {
      issues.push({
        severity: "error",
        code: "furniture_missing_room",
        entityId: item.id,
        message: `${item.name} references unknown room ${item.roomId}.`,
      });
      continue;
    }
    if (!furnitureFitsInRoom(room, item, EPS)) {
      issues.push({
        severity: "error",
        code: "furniture_outside_room",
        entityId: item.id,
        message: `${item.name} does not fit inside ${room.name}.`,
      });
    }
  }

  if (plan.rooms.length === 0) {
    issues.push({
      severity: "warning",
      code: "empty_plan",
      message: "No rooms placed yet.",
    });
  }

  issues.push(...checkDesignRules(plan, brief));

  return issues;
}

export function furnitureAbsolute(room: Room, item: FurnitureItem) {
  return {
    x: room.x + item.x,
    y: room.y + item.y,
    width: item.width,
    height: item.height,
  };
}
