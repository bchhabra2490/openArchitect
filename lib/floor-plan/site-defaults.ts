import {
  briefFrontageText,
  briefOmitsPorch,
  briefOmitsStairs,
  briefOmitsStreet,
  hasPorchRoom,
  hasStairsRoom,
} from "./brief-flags";
import { snap } from "./defaults";
import { ROOM_MINIMA, sharedEdgeLength } from "./design-rules";
import { uniqueId } from "./ids";
import type { Brief, Edge, FloorPlan, Opening, Room } from "./types";

const EPS = 0.02;
const TOUCH = 0.45;
const CELL = 0.5;
export const DEFAULT_STREET_WIDTH = 5;
export const SIDEWALK_WIDTH = 1.2;
export const PORCH_DEPTH = 1.5;
export const STAIR_WIDTH = 1;
export const STAIR_RUN = 2.5;
export const MAIN_DOOR_WIDTH = 1;

const EDGE_WORDS: Record<string, Edge> = {
  north: "north",
  south: "south",
  east: "east",
  west: "west",
};

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function idsIn(plan: FloorPlan) {
  return new Set([
    ...plan.rooms.map((room) => room.id),
    ...plan.openings.map((opening) => opening.id),
    ...plan.furniture.map((item) => item.id),
  ]);
}

function onPlotEdge(room: Room, edge: Edge, plot: FloorPlan["plot"]) {
  switch (edge) {
    case "north":
      return room.y <= EPS;
    case "south":
      return room.y + room.height >= plot.height - EPS;
    case "west":
      return room.x <= EPS;
    case "east":
      return room.x + room.width >= plot.width - EPS;
  }
}

function roomTouchesEdge(room: Room, edge: Edge, plot: FloorPlan["plot"]) {
  return onPlotEdge(room, edge, plot);
}

function setbackOnEdge(room: Room, edge: Edge, plot: FloorPlan["plot"]) {
  switch (edge) {
    case "north":
      return room.y;
    case "south":
      return plot.height - (room.y + room.height);
    case "west":
      return room.x;
    case "east":
      return plot.width - (room.x + room.width);
  }
}

function parseEdgeFromBrief(brief: Brief): Edge | null {
  const text = briefFrontageText(brief);
  const match =
    text.match(
      /(?:street|road|frontage|entrance|front|facing|faces)\s+(?:is\s+|on\s+|to\s+|towards\s+|toward\s+|from\s+)?(?:the\s+)?(north|south|east|west)/,
    ) ?? text.match(/(north|south|east|west)[\s-](?:facing|frontage|side road|road|street)/);
  if (!match) return null;
  return EDGE_WORDS[match[1]] ?? null;
}

function plotEdgeDoors(plan: FloorPlan): { room: Room; door: Opening; edge: Edge }[] {
  const found: { room: Room; door: Opening; edge: Edge }[] = [];
  for (const door of plan.openings.filter((opening) => opening.kind === "door")) {
    const room = plan.rooms.find((item) => item.id === door.roomId);
    if (!room) continue;
    if (!onPlotEdge(room, door.edge, plan.plot)) continue;
    found.push({ room, door, edge: door.edge });
  }
  return found;
}

function scoreEntry(room: Room) {
  if (room.type === "porch") return 0;
  if (room.type === "living") return 1;
  if (room.type === "hallway") return 2;
  if (room.type === "dining") return 3;
  return 4;
}

export function inferStreetEdge(brief: Brief, plan: FloorPlan): Edge {
  const fromBrief = parseEdgeFromBrief(brief);
  if (fromBrief) return fromBrief;
  if (plan.street?.edge) return plan.street.edge;

  const doors = plotEdgeDoors(plan).sort(
    (a, b) => scoreEntry(a.room) - scoreEntry(b.room) || b.door.width - a.door.width,
  );
  if (doors[0]) return doors[0].edge;

  const living = plan.rooms
    .filter((room) => room.type === "living" || room.type === "hallway" || room.type === "porch")
    .sort((a, b) => scoreEntry(a) - scoreEntry(b));
  const preference: Edge[] = ["south", "west", "east", "north"];
  for (const room of living) {
    for (const edge of preference) {
      if (roomTouchesEdge(room, edge, plan.plot) || setbackOnEdge(room, edge, plan.plot) >= 1) {
        return edge;
      }
    }
  }
  return "south";
}

function entryRoomForEdge(plan: FloorPlan, edge: Edge): Room | null {
  const ranked = [...plan.rooms].sort((a, b) => scoreEntry(a) - scoreEntry(b));
  const onEdge = ranked.filter(
    (room) =>
      room.type !== "stairs" &&
      (roomTouchesEdge(room, edge, plan.plot) || setbackOnEdge(room, edge, plan.plot) >= 0.5),
  );
  return onEdge[0] ?? ranked.find((room) => room.type === "living") ?? ranked[0] ?? null;
}

function overlaps(a: Room, b: Pick<Room, "x" | "y" | "width" | "height">) {
  return (
    a.x + EPS < b.x + b.width &&
    b.x + EPS < a.x + a.width &&
    a.y + EPS < b.y + b.height &&
    b.y + EPS < a.y + a.height
  );
}

function clampRoomContents(plan: FloorPlan, room: Room) {
  const lengthFor = (edge: Edge) =>
    edge === "north" || edge === "south" ? room.width : room.height;
  for (const opening of plan.openings) {
    if (opening.roomId !== room.id) continue;
    const length = lengthFor(opening.edge);
    opening.width = snap(Math.min(opening.width, Math.max(plan.gridSize, length)));
    opening.offset = snap(clamp(opening.offset, 0, Math.max(0, length - opening.width)));
  }
  for (const item of plan.furniture) {
    if (item.roomId !== room.id) continue;
    if (item.width > room.width) item.width = snap(room.width);
    if (item.height > room.height) item.height = snap(room.height);
    item.x = snap(clamp(item.x, 0, Math.max(0, room.width - item.width)));
    item.y = snap(clamp(item.y, 0, Math.max(0, room.height - item.height)));
  }
}

function addDoor(
  plan: FloorPlan,
  roomId: string,
  edge: Edge,
  room: Room,
  width = MAIN_DOOR_WIDTH,
) {
  const ids = idsIn(plan);
  const length = edge === "north" || edge === "south" ? room.width : room.height;
  const doorWidth = snap(Math.min(width, Math.max(plan.gridSize, length)));
  const offset = snap(clamp((length - doorWidth) / 2, 0, Math.max(0, length - doorWidth)));
  const exists = plan.openings.some(
    (opening) =>
      opening.roomId === roomId &&
      opening.edge === edge &&
      opening.kind === "door" &&
      Math.abs(opening.offset - offset) < 0.6,
  );
  if (exists) return;
  plan.openings.push({
    id: uniqueId(ids, "door-entry"),
    kind: "door",
    roomId,
    edge,
    offset,
    width: doorWidth,
  });
}

function transferDoorsToPorch(plan: FloorPlan, from: Room, porch: Room, edge: Edge) {
  for (const opening of plan.openings) {
    if (opening.roomId !== from.id || opening.edge !== edge) continue;
    opening.roomId = porch.id;
    const length = edge === "north" || edge === "south" ? porch.width : porch.height;
    const shift = edge === "north" || edge === "south" ? from.x - porch.x : from.y - porch.y;
    opening.offset = snap(
      clamp(opening.offset + shift, 0, Math.max(0, length - opening.width)),
    );
  }
}

function shrinkRoomFromEdge(room: Room, edge: Edge, depth: number) {
  switch (edge) {
    case "north":
      room.y = snap(room.y + depth);
      room.height = snap(room.height - depth);
      break;
    case "south":
      room.height = snap(room.height - depth);
      break;
    case "west":
      room.x = snap(room.x + depth);
      room.width = snap(room.width - depth);
      break;
    case "east":
      room.width = snap(room.width - depth);
      break;
  }
}

function porchRectOnEdge(
  entry: Room,
  edge: Edge,
  plot: FloorPlan["plot"],
  depth: number,
): Pick<Room, "x" | "y" | "width" | "height"> {
  switch (edge) {
    case "north":
      return { x: entry.x, y: 0, width: entry.width, height: depth };
    case "south":
      return { x: entry.x, y: plot.height - depth, width: entry.width, height: depth };
    case "west":
      return { x: 0, y: entry.y, width: depth, height: entry.height };
    case "east":
      return { x: plot.width - depth, y: entry.y, width: depth, height: entry.height };
  }
}

function placePorch(plan: FloorPlan, edge: Edge): boolean {
  if (hasPorchRoom(plan)) return false;
  const entry = entryRoomForEdge(plan, edge);
  if (!entry || entry.type === "porch") return false;

  const depth = PORCH_DEPTH;
  const gap = setbackOnEdge(entry, edge, plan.plot);
  let rect: Pick<Room, "x" | "y" | "width" | "height">;

  if (gap + EPS >= depth) {
    rect = porchRectOnEdge(entry, edge, plan.plot, depth);
    if (edge === "north") rect.y = snap(entry.y - depth);
    if (edge === "south") rect.y = snap(entry.y + entry.height);
    if (edge === "west") rect.x = snap(entry.x - depth);
    if (edge === "east") rect.x = snap(entry.x + entry.width);
    if (edge === "north" || edge === "south") {
      rect.x = entry.x;
      rect.width = entry.width;
      rect.height = snap(Math.min(depth, gap));
    } else {
      rect.y = entry.y;
      rect.height = entry.height;
      rect.width = snap(Math.min(depth, gap));
    }
  } else {
    const remain =
      edge === "north" || edge === "south"
        ? entry.height - depth
        : entry.width - depth;
    if (remain + EPS < ROOM_MINIMA[entry.type].minSide) return false;
    shrinkRoomFromEdge(entry, edge, depth);
    clampRoomContents(plan, entry);
    rect = porchRectOnEdge(entry, edge, plan.plot, depth);
    if (edge === "north") {
      rect.x = entry.x;
      rect.y = snap(entry.y - depth);
      rect.width = entry.width;
    } else if (edge === "south") {
      rect.x = entry.x;
      rect.y = snap(entry.y + entry.height);
      rect.width = entry.width;
    } else if (edge === "west") {
      rect.x = snap(entry.x - depth);
      rect.y = entry.y;
      rect.height = entry.height;
    } else {
      rect.x = snap(entry.x + entry.width);
      rect.y = entry.y;
      rect.height = entry.height;
    }
  }

  rect.x = snap(rect.x);
  rect.y = snap(rect.y);
  rect.width = snap(rect.width);
  rect.height = snap(rect.height);
  if (rect.width < 1.5 || rect.height < 1) return false;
  if (
    rect.x < -EPS ||
    rect.y < -EPS ||
    rect.x + rect.width > plan.plot.width + EPS ||
    rect.y + rect.height > plan.plot.height + EPS
  ) {
    return false;
  }
  if (plan.rooms.some((room) => overlaps(room, rect))) return false;

  const ids = idsIn(plan);
  const porch: Room = {
    id: uniqueId(ids, "porch"),
    name: "Porch",
    type: "porch",
    ...rect,
  };
  transferDoorsToPorch(plan, entry, porch, edge);
  plan.rooms.push(porch);
  addDoor(plan, porch.id, edge, porch, MAIN_DOOR_WIDTH);
  addDoor(plan, entry.id, edge, entry, Math.min(MAIN_DOOR_WIDTH, 0.9));
  return true;
}

function cellBlocked(rooms: Room[], x: number, y: number) {
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  return rooms.some(
    (room) =>
      cx > room.x + EPS &&
      cx < room.x + room.width - EPS &&
      cy > room.y + EPS &&
      cy < room.y + room.height - EPS,
  );
}

function findEmptySlot(
  plan: FloorPlan,
  width: number,
  height: number,
  preferX: number,
  preferY: number,
): Pick<Room, "x" | "y" | "width" | "height"> | null {
  const cols = Math.round(plan.plot.width / CELL);
  const rows = Math.round(plan.plot.height / CELL);
  const wCells = Math.round(width / CELL);
  const hCells = Math.round(height / CELL);
  let best: { x: number; y: number; score: number } | null = null;
  for (let row = 0; row <= rows - hCells; row += 1) {
    for (let col = 0; col <= cols - wCells; col += 1) {
      let clear = true;
      for (let dy = 0; dy < hCells && clear; dy += 1) {
        for (let dx = 0; dx < wCells && clear; dx += 1) {
          if (cellBlocked(plan.rooms, (col + dx) * CELL, (row + dy) * CELL)) clear = false;
        }
      }
      if (!clear) continue;
      const x = col * CELL;
      const y = row * CELL;
      const candidate = { x, y, width, height, id: "", name: "", type: "stairs" as const };
      const touches = plan.rooms.some((room) => sharedEdgeLength(room, candidate) >= TOUCH);
      if (!touches) continue;
      const score = Math.hypot(x + width / 2 - preferX, y + height / 2 - preferY);
      if (!best || score < best.score) best = { x, y, score };
    }
  }
  return best ? { x: best.x, y: best.y, width, height } : null;
}

function preferPoint(plan: FloorPlan, edge: Edge) {
  const porch = plan.rooms.find((room) => room.type === "porch");
  if (porch) return { x: porch.x + porch.width / 2, y: porch.y + porch.height / 2 };
  const entry = entryRoomForEdge(plan, edge);
  if (!entry) return { x: plan.plot.width / 2, y: plan.plot.height / 2 };
  switch (edge) {
    case "north":
      return { x: entry.x + entry.width / 2, y: entry.y };
    case "south":
      return { x: entry.x + entry.width / 2, y: entry.y + entry.height };
    case "west":
      return { x: entry.x, y: entry.y + entry.height / 2 };
    case "east":
      return { x: entry.x + entry.width, y: entry.y + entry.height / 2 };
  }
}

function carveStairsFromRoom(plan: FloorPlan, room: Room, edge: Edge): boolean {
  const alongVertical = edge === "north" || edge === "south";
  const depth = STAIR_WIDTH;
  const remain = alongVertical ? room.width - depth : room.height - depth;
  if (remain + EPS < ROOM_MINIMA[room.type].minSide) return false;

  const useEast = room.x + room.width >= plan.plot.width - 1 || room.x > plan.plot.width / 2;
  const useSouth = room.y + room.height >= plan.plot.height - 1 || room.y > plan.plot.height / 2;
  const stripEdge: Edge = alongVertical ? (useEast ? "east" : "west") : useSouth ? "south" : "north";
  const run = snap(Math.min(STAIR_RUN, alongVertical ? room.height : room.width));

  let stairs: Pick<Room, "x" | "y" | "width" | "height">;
  if (stripEdge === "west") {
    stairs = {
      x: room.x,
      y: edge === "south" ? snap(room.y + room.height - run) : room.y,
      width: depth,
      height: run,
    };
    room.x = snap(room.x + depth);
    room.width = snap(room.width - depth);
  } else if (stripEdge === "east") {
    stairs = {
      x: snap(room.x + room.width - depth),
      y: edge === "south" ? snap(room.y + room.height - run) : room.y,
      width: depth,
      height: run,
    };
    room.width = snap(room.width - depth);
  } else if (stripEdge === "north") {
    stairs = {
      x: edge === "east" ? snap(room.x + room.width - run) : room.x,
      y: room.y,
      width: run,
      height: depth,
    };
    room.y = snap(room.y + depth);
    room.height = snap(room.height - depth);
  } else {
    stairs = {
      x: edge === "east" ? snap(room.x + room.width - run) : room.x,
      y: snap(room.y + room.height - depth),
      width: run,
      height: depth,
    };
    room.height = snap(room.height - depth);
  }

  clampRoomContents(plan, room);
  if (plan.rooms.some((other) => other.id !== room.id && overlaps(other, stairs))) return false;

  const ids = idsIn(plan);
  plan.rooms.push({
    id: uniqueId(ids, "stairs"),
    name: "Stairs",
    type: "stairs",
    ...stairs,
  });
  const donor = plan.rooms.find((item) => item.id === room.id);
  if (donor) addDoor(plan, donor.id, stripEdge, donor, 0.9);
  return true;
}

function placeStairs(plan: FloorPlan, edge: Edge): boolean {
  if (hasStairsRoom(plan)) return false;
  const prefer = preferPoint(plan, edge);
  const slots = [
    findEmptySlot(plan, STAIR_WIDTH, STAIR_RUN, prefer.x, prefer.y),
    findEmptySlot(plan, STAIR_RUN, STAIR_WIDTH, prefer.x, prefer.y),
  ].filter(Boolean);
  const slot = slots[0];
  if (slot) {
    const ids = idsIn(plan);
    plan.rooms.push({
      id: uniqueId(ids, "stairs"),
      name: "Stairs",
      type: "stairs",
      x: snap(slot.x),
      y: snap(slot.y),
      width: snap(slot.width),
      height: snap(slot.height),
    });
    return true;
  }

  const donors = plan.rooms
    .filter((room) => room.type === "hallway" || room.type === "living" || room.type === "other")
    .sort((a, b) => a.width * a.height - b.width * b.height);
  for (const donor of donors) {
    if (carveStairsFromRoom(plan, donor, edge)) return true;
  }
  return false;
}

export function ensureSiteDefaults(plan: FloorPlan, brief: Brief): string[] {
  const added: string[] = [];
  if (plan.rooms.length === 0) return added;

  if (!briefOmitsStreet(brief)) {
    const edge = inferStreetEdge(brief, plan);
    const width = snap(plan.street?.width ?? DEFAULT_STREET_WIDTH);
    if (!plan.street || plan.street.edge !== edge) {
      plan.street = { edge, width };
      added.push(`${edge} street`);
    } else {
      plan.street.width = width;
    }
  }

  const edge = plan.street?.edge ?? inferStreetEdge(brief, plan);

  if (!briefOmitsPorch(brief) && placePorch(plan, edge)) {
    added.push("entrance porch");
  }
  if (!briefOmitsStairs(brief) && placeStairs(plan, edge)) {
    added.push("stairs");
  }

  return added;
}
