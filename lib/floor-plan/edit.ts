import { snap } from "./defaults";
import { DOOR_MIN_WIDTH, ROOM_MINIMA, sharedEdgeLength } from "./design-rules";
import { furniturePreset } from "./furniture-catalog";
import type { Edge, FloorPlan, FurnitureItem, Opening, Room, RoomType } from "./types";

const EPS = 0.02;
const TOUCH = 0.45;

function clonePlan(plan: FloorPlan): FloorPlan {
  return {
    units: "m",
    gridSize: plan.gridSize,
    plot: { ...plan.plot },
    street: plan.street ? { ...plan.street } : null,
    rooms: plan.rooms.map((room) => ({ ...room })),
    openings: plan.openings.map((opening) => ({ ...opening })),
    furniture: plan.furniture.map((item) => ({ ...item })),
  };
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function yOverlap(a: Room, b: Room) {
  return Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > TOUCH;
}

function xOverlap(a: Room, b: Room) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > TOUCH;
}

function minSideFor(room: Room) {
  return ROOM_MINIMA[room.type].minSide;
}

function neighborsOn(room: Room, rooms: Room[], edge: Edge): Room[] {
  return rooms.filter((other) => {
    if (other.id === room.id) return false;
    if (sharedEdgeLength(room, other) < TOUCH) return false;
    switch (edge) {
      case "east":
        return Math.abs(other.x - (room.x + room.width)) < EPS && yOverlap(room, other);
      case "west":
        return Math.abs(room.x - (other.x + other.width)) < EPS && yOverlap(room, other);
      case "south":
        return Math.abs(other.y - (room.y + room.height)) < EPS && xOverlap(room, other);
      case "north":
        return Math.abs(room.y - (other.y + other.height)) < EPS && xOverlap(room, other);
    }
  });
}

export function edgeLength(room: Room, edge: Edge) {
  return edge === "north" || edge === "south" ? room.width : room.height;
}

export function fitOpening(opening: Opening, room: Room, gridSize: number) {
  const length = edgeLength(room, opening.edge);
  opening.width = snap(Math.min(opening.width, Math.max(gridSize, length)), gridSize);
  opening.offset = snap(
    clamp(opening.offset, 0, Math.max(0, length - opening.width)),
    gridSize,
  );
}

export function defaultOpeningWidth(kind: Opening["kind"], room: Room, gridSize: number) {
  const preferred = kind === "window" ? 1.2 : (DOOR_MIN_WIDTH[room.type] ?? 0.9);
  return snap(Math.max(gridSize, preferred), gridSize);
}

function clampOpenings(plan: FloorPlan, room: Room) {
  for (const opening of plan.openings) {
    if (opening.roomId !== room.id) continue;
    fitOpening(opening, room, plan.gridSize);
  }
}

function clampFurnitureInRoom(plan: FloorPlan, room: Room) {
  const grid = plan.gridSize;
  for (const item of plan.furniture) {
    if (item.roomId !== room.id) continue;
    if (item.width > room.width) item.width = snap(room.width, grid);
    if (item.height > room.height) item.height = snap(room.height, grid);
    item.x = snap(clamp(item.x, 0, Math.max(0, room.width - item.width)), grid);
    item.y = snap(clamp(item.y, 0, Math.max(0, room.height - item.height)), grid);
  }
}

export function resizeRoomWall(
  plan: FloorPlan,
  roomId: string,
  edge: Edge,
  position: number,
): FloorPlan {
  const next = clonePlan(plan);
  const grid = next.gridSize;
  const room = next.rooms.find((item) => item.id === roomId);
  if (!room) return plan;
  const others = next.rooms.filter((item) => item.id !== roomId);
  const neighbors = neighborsOn(room, others, edge);
  const neighborIds = new Set(neighbors.map((item) => item.id));
  const snapped = snap(position, grid);

  if (edge === "west") {
    let min = 0;
    for (const other of others) {
      if (neighborIds.has(other.id) || !yOverlap(room, other)) continue;
      if (other.x + other.width <= room.x + EPS) {
        min = Math.max(min, other.x + other.width);
      }
    }
    for (const neighbor of neighbors) {
      min = Math.max(min, neighbor.x + minSideFor(neighbor));
    }
    const pos = clamp(snapped, min, room.x + room.width - minSideFor(room));
    const right = room.x + room.width;
    for (const neighbor of neighbors) {
      neighbor.width = snap(pos - neighbor.x, grid);
    }
    room.x = pos;
    room.width = snap(right - pos, grid);
  } else if (edge === "east") {
    let max = next.plot.width;
    for (const other of others) {
      if (neighborIds.has(other.id) || !yOverlap(room, other)) continue;
      if (other.x >= room.x + room.width - EPS) {
        max = Math.min(max, other.x);
      }
    }
    for (const neighbor of neighbors) {
      max = Math.min(max, neighbor.x + neighbor.width - minSideFor(neighbor));
    }
    const pos = clamp(snapped, room.x + minSideFor(room), max);
    for (const neighbor of neighbors) {
      const right = neighbor.x + neighbor.width;
      neighbor.x = pos;
      neighbor.width = snap(right - pos, grid);
    }
    room.width = snap(pos - room.x, grid);
  } else if (edge === "north") {
    let min = 0;
    for (const other of others) {
      if (neighborIds.has(other.id) || !xOverlap(room, other)) continue;
      if (other.y + other.height <= room.y + EPS) {
        min = Math.max(min, other.y + other.height);
      }
    }
    for (const neighbor of neighbors) {
      min = Math.max(min, neighbor.y + minSideFor(neighbor));
    }
    const pos = clamp(snapped, min, room.y + room.height - minSideFor(room));
    const bottom = room.y + room.height;
    for (const neighbor of neighbors) {
      neighbor.height = snap(pos - neighbor.y, grid);
    }
    room.y = pos;
    room.height = snap(bottom - pos, grid);
  } else {
    let max = next.plot.height;
    for (const other of others) {
      if (neighborIds.has(other.id) || !xOverlap(room, other)) continue;
      if (other.y >= room.y + room.height - EPS) {
        max = Math.min(max, other.y);
      }
    }
    for (const neighbor of neighbors) {
      max = Math.min(max, neighbor.y + neighbor.height - minSideFor(neighbor));
    }
    const pos = clamp(snapped, room.y + minSideFor(room), max);
    for (const neighbor of neighbors) {
      const bottom = neighbor.y + neighbor.height;
      neighbor.y = pos;
      neighbor.height = snap(bottom - pos, grid);
    }
    room.height = snap(pos - room.y, grid);
  }

  for (const changed of [room, ...neighbors]) {
    if (changed.width < minSideFor(changed)) changed.width = snap(minSideFor(changed), grid);
    if (changed.height < minSideFor(changed)) changed.height = snap(minSideFor(changed), grid);
    clampOpenings(next, changed);
    clampFurnitureInRoom(next, changed);
  }
  return next;
}

export function replaceFurniture(
  plan: FloorPlan,
  furnitureId: string,
  kind: string,
): FloorPlan {
  const next = clonePlan(plan);
  const item = next.furniture.find((entry) => entry.id === furnitureId);
  if (!item) return plan;
  const room = next.rooms.find((entry) => entry.id === item.roomId);
  if (!room) return plan;
  const preset = furniturePreset(kind);
  const grid = next.gridSize;
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  item.kind = preset.kind;
  item.name = preset.name;
  item.width = snap(Math.min(preset.width, room.width), grid);
  item.height = snap(Math.min(preset.height, room.height), grid);
  item.x = snap(clamp(cx - item.width / 2, 0, room.width - item.width), grid);
  item.y = snap(clamp(cy - item.height / 2, 0, room.height - item.height), grid);
  return next;
}

export function moveFurniture(
  plan: FloorPlan,
  furnitureId: string,
  x: number,
  y: number,
): FloorPlan {
  const next = clonePlan(plan);
  const item = next.furniture.find((entry) => entry.id === furnitureId);
  if (!item) return plan;
  const room = next.rooms.find((entry) => entry.id === item.roomId);
  if (!room) return plan;
  item.x = snap(clamp(x, 0, room.width - item.width), next.gridSize);
  item.y = snap(clamp(y, 0, room.height - item.height), next.gridSize);
  return next;
}

export function replaceOpening(
  plan: FloorPlan,
  openingId: string,
  kind: Opening["kind"],
): FloorPlan {
  const next = clonePlan(plan);
  const opening = next.openings.find((entry) => entry.id === openingId);
  if (!opening) return plan;
  opening.kind = kind;
  return next;
}

export function moveOpening(
  plan: FloorPlan,
  openingId: string,
  offset: number,
  edge?: Edge,
): FloorPlan {
  const next = clonePlan(plan);
  const opening = next.openings.find((entry) => entry.id === openingId);
  if (!opening) return plan;
  const room = next.rooms.find((entry) => entry.id === opening.roomId);
  if (!room) return plan;
  if (edge) opening.edge = edge;
  opening.offset = offset;
  fitOpening(opening, room, next.gridSize);
  return next;
}

export function resizeOpening(
  plan: FloorPlan,
  openingId: string,
  width: number,
  offset?: number,
): FloorPlan {
  const next = clonePlan(plan);
  const opening = next.openings.find((entry) => entry.id === openingId);
  if (!opening) return plan;
  const room = next.rooms.find((entry) => entry.id === opening.roomId);
  if (!room) return plan;
  if (offset != null) opening.offset = offset;
  opening.width = width;
  fitOpening(opening, room, next.gridSize);
  return next;
}

export function resizeFurniture(
  plan: FloorPlan,
  furnitureId: string,
  width: number,
  height: number,
): FloorPlan {
  const next = clonePlan(plan);
  const item = next.furniture.find((entry) => entry.id === furnitureId);
  if (!item) return plan;
  const room = next.rooms.find((entry) => entry.id === item.roomId);
  if (!room) return plan;
  item.width = snap(clamp(width, next.gridSize, room.width - item.x), next.gridSize);
  item.height = snap(clamp(height, next.gridSize, room.height - item.y), next.gridSize);
  return next;
}

export function furnitureAt(item: FurnitureItem, room: Room) {
  return { x: room.x + item.x, y: room.y + item.y };
}

export function moveRoom(plan: FloorPlan, roomId: string, x: number, y: number): FloorPlan {
  const next = clonePlan(plan);
  const room = next.rooms.find((entry) => entry.id === roomId);
  if (!room) return plan;
  const grid = next.gridSize;
  room.x = snap(clamp(x, 0, Math.max(0, next.plot.width - room.width)), grid);
  room.y = snap(clamp(y, 0, Math.max(0, next.plot.height - room.height)), grid);
  return next;
}

export function renameRoom(plan: FloorPlan, roomId: string, name: string): FloorPlan {
  const next = clonePlan(plan);
  const room = next.rooms.find((entry) => entry.id === roomId);
  if (!room) return plan;
  room.name = name.slice(0, 40);
  return next;
}

export function renameFurniture(
  plan: FloorPlan,
  furnitureId: string,
  name: string,
): FloorPlan {
  const next = clonePlan(plan);
  const item = next.furniture.find((entry) => entry.id === furnitureId);
  if (!item) return plan;
  item.name = name.slice(0, 40);
  return next;
}

function furnitureOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function placeFurnitureInRoom(
  room: Room,
  occupants: FurnitureItem[],
  size: { width: number; height: number },
  grid: number,
  preferred?: { x: number; y: number },
) {
  const width = snap(clamp(size.width, grid, room.width), grid);
  const height = snap(clamp(size.height, grid, room.height), grid);
  const maxX = Math.max(0, room.width - width);
  const maxY = Math.max(0, room.height - height);
  let x = snap(clamp(preferred?.x ?? (room.width - width) / 2, 0, maxX), grid);
  let y = snap(clamp(preferred?.y ?? (room.height - height) / 2, 0, maxY), grid);
  const others = occupants.filter((item) => item.roomId === room.id);
  for (let step = 0; step < others.length + 8; step += 1) {
    const hit = others.some((item) => furnitureOverlap({ x, y, width, height }, item));
    if (!hit) break;
    x = snap(x + grid, grid);
    if (x > maxX) {
      x = 0;
      y = snap(clamp(y + grid, 0, maxY), grid);
    }
  }
  return { x: snap(clamp(x, 0, maxX), grid), y: snap(clamp(y, 0, maxY), grid), width, height };
}

const DEFAULT_ROOM_FOOTPRINT: Record<
  RoomType,
  { width: number; height: number; name: string }
> = {
  bedroom: { width: 3.5, height: 3, name: "Bedroom" },
  bathroom: { width: 1.5, height: 2, name: "Bathroom" },
  kitchen: { width: 2.5, height: 2.5, name: "Kitchen" },
  living: { width: 4, height: 3.5, name: "Living" },
  dining: { width: 3, height: 3, name: "Dining" },
  hallway: { width: 1.2, height: 3, name: "Hallway" },
  closet: { width: 1.5, height: 1, name: "Closet" },
  balcony: { width: 2, height: 1.5, name: "Balcony" },
  office: { width: 3, height: 2.5, name: "Office" },
  laundry: { width: 1.5, height: 1.5, name: "Laundry" },
  stairs: { width: 2, height: 2.5, name: "Stairs" },
  porch: { width: 2, height: 1.5, name: "Porch" },
  other: { width: 2.5, height: 2, name: "Room" },
};

export function defaultRoomFootprint(type: RoomType) {
  return DEFAULT_ROOM_FOOTPRINT[type];
}

function roomRectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width - EPS &&
    a.x + a.width > b.x + EPS &&
    a.y < b.y + b.height - EPS &&
    a.y + a.height > b.y + EPS
  );
}

/** First free grid slot that fits; falls back to top-left if the plot is full. */
export function findFreeRoomPlacement(
  plan: FloorPlan,
  width: number,
  height: number,
): { x: number; y: number } {
  const grid = plan.gridSize || 0.5;
  const w = snap(Math.max(width, grid), grid);
  const h = snap(Math.max(height, grid), grid);
  const maxX = plan.plot.width - w;
  const maxY = plan.plot.height - h;
  if (maxX < -EPS || maxY < -EPS) {
    return { x: 0, y: 0 };
  }

  for (let y = 0; y <= maxY + EPS; y = snap(y + grid, grid)) {
    for (let x = 0; x <= maxX + EPS; x = snap(x + grid, grid)) {
      const sx = snap(clamp(x, 0, maxX), grid);
      const sy = snap(clamp(y, 0, maxY), grid);
      const candidate = { x: sx, y: sy, width: w, height: h };
      if (!plan.rooms.some((room) => roomRectsOverlap(candidate, room))) {
        return { x: sx, y: sy };
      }
    }
  }

  return { x: 0, y: 0 };
}
