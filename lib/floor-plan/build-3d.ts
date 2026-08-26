import { roomFill } from "./plan-svg";
import type { DisplayLayers } from "./layers";
import { DEFAULT_DISPLAY_LAYERS } from "./layers";
import { SIDEWALK_WIDTH } from "./site-defaults";
import type { Edge, FloorPlan, FurnitureItem, OpeningKind, Room } from "./types";

export const WALL_HEIGHT = 2.8;
export const WALL_THICKNESS = 0.12;
const DOOR_HEIGHT = 2.1;
const WINDOW_SILL = 0.9;
const WINDOW_HEAD = 2.1;
const FLOOR_THICKNESS = 0.08;
const RAILING_TYPES = new Set(["porch", "balcony"]);
const EPS = 0.04;

export type Mesh3D = {
  name: string;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  opacity?: number;
};

export type FloorPlan3dModel = {
  meshes: Mesh3D[];
  center: { x: number; y: number; z: number };
  radius: number;
};

const FURNITURE_TALL: Record<string, number> = {
  bed: 0.5,
  sofa: 0.75,
  table: 0.75,
  desk: 0.75,
  wardrobe: 2.1,
  counter: 0.9,
  stove: 0.9,
  sink: 0.85,
  fridge: 1.8,
  toilet: 0.42,
  chair: 0.45,
};

function yOverlap(a: Room, b: Room) {
  return Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > EPS;
}

function xOverlap(a: Room, b: Room) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPS;
}

function sharesEdge(room: Room, other: Room, edge: Edge) {
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
}

function opposite(edge: Edge): Edge {
  switch (edge) {
    case "north":
      return "south";
    case "south":
      return "north";
    case "east":
      return "west";
    case "west":
      return "east";
  }
}

function edgeLength(room: Room, edge: Edge) {
  return edge === "north" || edge === "south" ? room.width : room.height;
}

function wallHeightFor(room: Room) {
  return RAILING_TYPES.has(room.type) ? 1 : WALL_HEIGHT;
}

type Span = { start: number; end: number; kind: OpeningKind };

function clipSpan(span: Span, length: number): Span | null {
  const start = Math.max(0, span.start);
  const end = Math.min(length, span.end);
  if (end - start < 0.08) return null;
  return { start, end, kind: span.kind };
}

function openingsForEdge(
  plan: FloorPlan,
  room: Room,
  edge: Edge,
  showDoors: boolean,
): Span[] {
  const length = edgeLength(room, edge);
  const spans: Span[] = [];
  for (const opening of plan.openings) {
    if (!showDoors && opening.kind === "door") continue;
    if (opening.roomId === room.id && opening.edge === edge) {
      const clipped = clipSpan(
        { start: opening.offset, end: opening.offset + opening.width, kind: opening.kind },
        length,
      );
      if (clipped) spans.push(clipped);
    }
  }
  const facing = opposite(edge);
  for (const other of plan.rooms) {
    if (other.id === room.id || !sharesEdge(room, other, edge)) continue;
    for (const opening of plan.openings) {
      if (!showDoors && opening.kind === "door") continue;
      if (opening.roomId !== other.id || opening.edge !== facing) continue;
      const shift =
        edge === "north" || edge === "south" ? other.x - room.x : other.y - room.y;
      const clipped = clipSpan(
        {
          start: opening.offset + shift,
          end: opening.offset + shift + opening.width,
          kind: opening.kind,
        },
        length,
      );
      if (clipped) spans.push(clipped);
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function box(
  name: string,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  opacity?: number,
): Mesh3D {
  return { name, cx, cy, cz, sx, sy, sz, color, opacity };
}

function alongWall(
  room: Room,
  edge: Edge,
  start: number,
  end: number,
  y0: number,
  height: number,
  color: string,
  name: string,
): Mesh3D | null {
  const length = end - start;
  if (length < 0.04 || height < 0.04) return null;
  const t = WALL_THICKNESS;
  const mid = (start + end) / 2;
  const cy = y0 + height / 2;
  switch (edge) {
    case "north":
      return box(name, room.x + mid, cy, room.y + t / 2, length, height, t, color);
    case "south":
      return box(
        name,
        room.x + mid,
        cy,
        room.y + room.height - t / 2,
        length,
        height,
        t,
        color,
      );
    case "west":
      return box(name, room.x + t / 2, cy, room.y + mid, t, height, length, color);
    case "east":
      return box(
        name,
        room.x + room.width - t / 2,
        cy,
        room.y + mid,
        t,
        height,
        length,
        color,
      );
  }
}

function wallMeshes(plan: FloorPlan, room: Room, showDoors: boolean): Mesh3D[] {
  const meshes: Mesh3D[] = [];
  const color = "#efe8dc";
  const top = wallHeightFor(room);
  const edges: Edge[] = ["north", "south", "east", "west"];
  for (const edge of edges) {
    const length = edgeLength(room, edge);
    const openings = openingsForEdge(plan, room, edge, showDoors);
    let cursor = 0;
    const emit = (start: number, end: number, y0: number, height: number, label: string) => {
      const mesh = alongWall(room, edge, start, end, y0, height, color, `${room.id}-${label}`);
      if (mesh) meshes.push(mesh);
    };
    for (const opening of openings) {
      if (opening.start > cursor) emit(cursor, opening.start, 0, top, `${edge}-wall`);
      if (opening.kind === "window" && top > WINDOW_HEAD) {
        emit(opening.start, opening.end, 0, Math.min(WINDOW_SILL, top), `${edge}-sill`);
        emit(
          opening.start,
          opening.end,
          WINDOW_HEAD,
          Math.max(0, top - WINDOW_HEAD),
          `${edge}-head`,
        );
        const glass = alongWall(
          room,
          edge,
          opening.start,
          opening.end,
          WINDOW_SILL,
          WINDOW_HEAD - WINDOW_SILL,
          "#8eb8dc",
          `${room.id}-${edge}-glass`,
        );
        if (glass) meshes.push({ ...glass, opacity: 0.35 });
      } else if (opening.kind === "door" && top > DOOR_HEIGHT) {
        emit(
          opening.start,
          opening.end,
          DOOR_HEIGHT,
          Math.max(0, top - DOOR_HEIGHT),
          `${edge}-lintel`,
        );
      }
      cursor = Math.max(cursor, opening.end);
    }
    if (cursor < length) emit(cursor, length, 0, top, `${edge}-wall`);
  }
  return meshes;
}

function stairMeshes(room: Room): Mesh3D[] {
  const vertical = room.height >= room.width;
  const span = vertical ? room.height : room.width;
  const count = Math.max(5, Math.round(span / 0.28));
  const rise = Math.min(0.18, WALL_HEIGHT / count);
  const going = span / count;
  const color = "#c4b8a8";
  const meshes: Mesh3D[] = [];
  for (let i = 0; i < count; i += 1) {
    const h = (i + 1) * rise;
    if (vertical) {
      meshes.push(
        box(
          `${room.id}-tread-${i}`,
          room.x + room.width / 2,
          h / 2,
          room.y + (i + 0.5) * going,
          room.width - 0.16,
          h,
          going - 0.02,
          color,
        ),
      );
    } else {
      meshes.push(
        box(
          `${room.id}-tread-${i}`,
          room.x + (i + 0.5) * going,
          h / 2,
          room.y + room.height / 2,
          going - 0.02,
          h,
          room.height - 0.16,
          color,
        ),
      );
    }
  }
  return meshes;
}

function furnitureMesh(room: Room, item: FurnitureItem): Mesh3D {
  const tall = FURNITURE_TALL[item.kind] ?? 0.7;
  return box(
    item.name,
    room.x + item.x + item.width / 2,
    tall / 2,
    room.y + item.y + item.height / 2,
    Math.max(0.12, item.width),
    tall,
    Math.max(0.12, item.height),
    "#7d7468",
  );
}

function streetMeshes(plan: FloorPlan): Mesh3D[] {
  const street = plan.street;
  if (!street) return [];
  const walk = SIDEWALK_WIDTH;
  const road = street.width;
  const { width, height } = plan.plot;
  switch (street.edge) {
    case "north":
      return [
        box("sidewalk", width / 2, 0.03, -walk / 2, width + 0.4, 0.06, walk, "#d9d3c7"),
        box("street", width / 2, 0.02, -walk - road / 2, width + 0.4, 0.04, road, "#8b8680"),
      ];
    case "south":
      return [
        box("sidewalk", width / 2, 0.03, height + walk / 2, width + 0.4, 0.06, walk, "#d9d3c7"),
        box(
          "street",
          width / 2,
          0.02,
          height + walk + road / 2,
          width + 0.4,
          0.04,
          road,
          "#8b8680",
        ),
      ];
    case "west":
      return [
        box("sidewalk", -walk / 2, 0.03, height / 2, walk, 0.06, height + 0.4, "#d9d3c7"),
        box("street", -walk - road / 2, 0.02, height / 2, road, 0.04, height + 0.4, "#8b8680"),
      ];
    case "east":
      return [
        box("sidewalk", width + walk / 2, 0.03, height / 2, walk, 0.06, height + 0.4, "#d9d3c7"),
        box(
          "street",
          width + walk + road / 2,
          0.02,
          height / 2,
          road,
          0.04,
          height + 0.4,
          "#8b8680",
        ),
      ];
  }
  return [];
}

export function buildFloorPlan3d(
  plan: FloorPlan,
  layers: DisplayLayers = DEFAULT_DISPLAY_LAYERS,
): FloorPlan3dModel {
  const meshes: Mesh3D[] = [
    box(
      "plot",
      plan.plot.width / 2,
      -0.04,
      plan.plot.height / 2,
      plan.plot.width + 0.4,
      0.08,
      plan.plot.height + 0.4,
      "#d8d0c4",
    ),
    ...streetMeshes(plan),
  ];

  for (const room of plan.rooms) {
    const fill = roomFill(room.type, layers.roomColors, room.color);
    meshes.push(
      box(
        `${room.id}-floor`,
        room.x + room.width / 2,
        FLOOR_THICKNESS / 2,
        room.y + room.height / 2,
        room.width,
        FLOOR_THICKNESS,
        room.height,
        fill,
      ),
    );
    meshes.push(...wallMeshes(plan, room, layers.doors));
    if (room.type === "stairs") meshes.push(...stairMeshes(room));
  }

  if (layers.objects) {
    for (const item of plan.furniture) {
      const room = plan.rooms.find((entry) => entry.id === item.roomId);
      if (!room) continue;
      meshes.push(furnitureMesh(room, item));
    }
  }

  const cx = plan.plot.width / 2;
  const cz = plan.plot.height / 2;
  const radius = Math.max(plan.plot.width, plan.plot.height, 6) * 0.9;
  return { meshes, center: { x: cx, y: 0.4, z: cz }, radius };
}
