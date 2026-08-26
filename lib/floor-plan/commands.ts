import { emptyPlan, snap } from "./defaults";
import {
  fitOpening,
  moveFurniture,
  moveOpening,
  replaceFurniture,
  replaceOpening,
  resizeFurniture,
  resizeOpening,
  resizeRoomWall,
} from "./edit";
import { sanitizeExportFilename } from "./export-name";
import { slugId, uniqueId } from "./ids";
import { DEFAULT_STREET_WIDTH, ensureSiteDefaults } from "./site-defaults";
import type {
  Brief,
  CommandResult,
  Edge,
  ExportFormat,
  FloorPlan,
  FurnitureItem,
  Opening,
  Room,
} from "./types";
import { validatePlan } from "./validate";
import type { z } from "zod";
import type {
  addFurnitureInputSchema,
  addOpeningInputSchema,
  addRoomInputSchema,
  applyLayoutInputSchema,
  moveFurnitureInputSchema,
  moveOpeningInputSchema,
  replaceFurnitureInputSchema,
  replaceOpeningInputSchema,
  resizeFurnitureInputSchema,
  resizeOpeningInputSchema,
  resizeWallInputSchema,
  setPlotInputSchema,
  updateBriefInputSchema,
  updateRoomInputSchema,
} from "./schema";

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

function cloneBrief(brief: Brief): Brief {
  return {
    ...brief,
    notes: [...brief.notes],
    answers: { ...brief.answers },
  };
}

function result(
  brief: Brief,
  plan: FloorPlan,
  summary: string,
): CommandResult {
  return {
    brief: cloneBrief(brief),
    plan: clonePlan(plan),
    issues: validatePlan(plan, brief),
    summary,
  };
}

function existingIds(plan: FloorPlan): Set<string> {
  return new Set([
    ...plan.rooms.map((room) => room.id),
    ...plan.openings.map((opening) => opening.id),
    ...plan.furniture.map((item) => item.id),
  ]);
}

function assignId(existing: Set<string>, prefix: string, requested?: string, name?: string) {
  const candidate = requested?.toLowerCase() ?? slugId(prefix, name);
  const id = uniqueId(existing, candidate);
  existing.add(id);
  return id;
}

function snapRoom(room: Omit<Room, "id"> & { id: string }): Room {
  return {
    ...room,
    x: snap(room.x),
    y: snap(room.y),
    width: snap(room.width),
    height: snap(room.height),
  };
}

export function commandGetBrief(brief: Brief, plan: FloorPlan): CommandResult {
  const missing: string[] = [];
  if (!brief.plotWidthM || !brief.plotHeightM) missing.push("plot size");
  if (brief.bedroomCount == null) missing.push("bedroom count");
  return result(
    brief,
    plan,
    missing.length
      ? `Brief on file. Still missing: ${missing.join(", ")}.`
      : "Brief is complete enough to draw.",
  );
}

export function commandUpdateBrief(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof updateBriefInputSchema>,
): CommandResult {
  const nextBrief: Brief = {
    ...cloneBrief(brief),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.plotWidthM !== undefined ? { plotWidthM: input.plotWidthM } : {}),
    ...(input.plotHeightM !== undefined ? { plotHeightM: input.plotHeightM } : {}),
    ...(input.bedroomCount !== undefined ? { bedroomCount: input.bedroomCount } : {}),
    ...(input.bathroomCount !== undefined ? { bathroomCount: input.bathroomCount } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    answers: { ...brief.answers, ...input.answers },
  };
  const nextPlan = clonePlan(plan);
  if (nextBrief.plotWidthM && nextBrief.plotHeightM) {
    nextPlan.plot = {
      width: snap(nextBrief.plotWidthM),
      height: snap(nextBrief.plotHeightM),
    };
  }
  return result(nextBrief, nextPlan, "Updated the project brief.");
}

export function commandSetPlot(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof setPlotInputSchema>,
): CommandResult {
  const nextPlan = clonePlan(plan);
  nextPlan.plot = { width: snap(input.width), height: snap(input.height) };
  const nextBrief = cloneBrief(brief);
  nextBrief.plotWidthM = nextPlan.plot.width;
  nextBrief.plotHeightM = nextPlan.plot.height;
  return result(
    nextBrief,
    nextPlan,
    `Plot set to ${nextPlan.plot.width}×${nextPlan.plot.height} m.`,
  );
}

function materializeRooms(
  existing: Set<string>,
  rooms: z.infer<typeof applyLayoutInputSchema>["rooms"],
): Room[] {
  return rooms.map((room) =>
    snapRoom({
      id: assignId(existing, "room", room.id, room.name),
      name: room.name,
      type: room.type,
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
    }),
  );
}

export function commandApplyLayout(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof applyLayoutInputSchema>,
): CommandResult {
  const nextPlan = clonePlan(emptyPlan());
  nextPlan.gridSize = plan.gridSize;
  nextPlan.plot = input.plot
    ? { width: snap(input.plot.width), height: snap(input.plot.height) }
    : { ...plan.plot };
  const ids = new Set<string>();
  nextPlan.rooms = materializeRooms(ids, input.rooms);
  nextPlan.openings = (input.openings ?? []).map((opening) => ({
    id: assignId(ids, "opening", opening.id, opening.kind),
    kind: opening.kind,
    roomId: opening.roomId,
    edge: opening.edge,
    offset: snap(opening.offset),
    width: snap(opening.width),
  }));
  nextPlan.furniture = (input.furniture ?? []).map((item) => ({
    id: assignId(ids, "furn", item.id, item.name),
    roomId: item.roomId,
    name: item.name,
    kind: item.kind,
    x: snap(item.x),
    y: snap(item.y),
    width: snap(item.width),
    height: snap(item.height),
  }));
  if (input.street) {
    nextPlan.street = {
      edge: input.street.edge,
      width: snap(input.street.width ?? DEFAULT_STREET_WIDTH),
    };
  }
  const nextBrief = cloneBrief(brief);
  nextBrief.plotWidthM = nextPlan.plot.width;
  nextBrief.plotHeightM = nextPlan.plot.height;
  const added = ensureSiteDefaults(nextPlan, nextBrief);
  const roomIds = new Set(nextPlan.rooms.map((room) => room.id));
  const unknownRooms = [
    ...nextPlan.openings.filter((opening) => !roomIds.has(opening.roomId)),
    ...nextPlan.furniture.filter((item) => !roomIds.has(item.roomId)),
  ];
  const extras = added.length ? ` Added ${added.join(", ")}.` : "";
  const summary =
    unknownRooms.length > 0
      ? `Applied layout with ${nextPlan.rooms.length} rooms. Some openings/furniture reference unknown room ids.${extras}`
      : `Applied layout with ${nextPlan.rooms.length} rooms, ${nextPlan.openings.length} openings, ${nextPlan.furniture.length} furniture items.${extras}`;
  return result(nextBrief, nextPlan, summary);
}

export function commandAddRoom(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof addRoomInputSchema>,
): CommandResult {
  const nextPlan = clonePlan(plan);
  const ids = existingIds(nextPlan);
  const room = snapRoom({
    id: assignId(ids, "room", input.id, input.name),
    name: input.name,
    type: input.type,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
  });
  nextPlan.rooms.push(room);
  return result(brief, nextPlan, `Added ${room.name} (${room.id}).`);
}

export function commandUpdateRoom(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof updateRoomInputSchema>,
): CommandResult {
  const nextPlan = clonePlan(plan);
  const room = nextPlan.rooms.find((item) => item.id === input.id);
  if (!room) {
    return result(brief, plan, `No room with id ${input.id}.`);
  }
  if (input.name !== undefined) room.name = input.name;
  if (input.type !== undefined) room.type = input.type;
  if (input.x !== undefined) room.x = snap(input.x);
  if (input.y !== undefined) room.y = snap(input.y);
  if (input.width !== undefined) room.width = snap(input.width);
  if (input.height !== undefined) room.height = snap(input.height);
  return result(brief, nextPlan, `Updated ${room.name}.`);
}

export function commandRemoveRoom(
  brief: Brief,
  plan: FloorPlan,
  id: string,
): CommandResult {
  const nextPlan = clonePlan(plan);
  const before = nextPlan.rooms.length;
  nextPlan.rooms = nextPlan.rooms.filter((room) => room.id !== id);
  nextPlan.openings = nextPlan.openings.filter((opening) => opening.roomId !== id);
  nextPlan.furniture = nextPlan.furniture.filter((item) => item.roomId !== id);
  if (nextPlan.rooms.length === before) {
    return result(brief, plan, `No room with id ${id}.`);
  }
  return result(brief, nextPlan, `Removed room ${id}.`);
}

export function commandAddOpening(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof addOpeningInputSchema>,
): CommandResult {
  const room = plan.rooms.find((entry) => entry.id === input.roomId);
  if (!room) {
    return result(brief, plan, `No room with id ${input.roomId}.`);
  }
  const nextPlan = clonePlan(plan);
  const ids = existingIds(nextPlan);
  const nextRoom = nextPlan.rooms.find((entry) => entry.id === input.roomId);
  if (!nextRoom) {
    return result(brief, plan, `No room with id ${input.roomId}.`);
  }
  const opening: Opening = {
    id: assignId(ids, input.kind, input.id, input.kind),
    kind: input.kind,
    roomId: input.roomId,
    edge: input.edge,
    offset: snap(input.offset, nextPlan.gridSize),
    width: snap(input.width, nextPlan.gridSize),
  };
  fitOpening(opening, nextRoom, nextPlan.gridSize);
  nextPlan.openings.push(opening);
  return result(
    brief,
    nextPlan,
    `Added ${opening.kind} ${opening.id} on ${opening.roomId} ${opening.edge} wall.`,
  );
}

export function commandRemoveOpening(
  brief: Brief,
  plan: FloorPlan,
  id: string,
): CommandResult {
  const nextPlan = clonePlan(plan);
  const before = nextPlan.openings.length;
  nextPlan.openings = nextPlan.openings.filter((opening) => opening.id !== id);
  if (nextPlan.openings.length === before) {
    return result(brief, plan, `No opening with id ${id}.`);
  }
  return result(brief, nextPlan, `Removed opening ${id}.`);
}

export function commandAddFurniture(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof addFurnitureInputSchema>,
): CommandResult {
  const nextPlan = clonePlan(plan);
  const ids = existingIds(nextPlan);
  const grid = nextPlan.gridSize;
  const item: FurnitureItem = {
    id: assignId(ids, "furn", input.id, input.name),
    roomId: input.roomId,
    name: input.name,
    kind: input.kind,
    x: snap(input.x, grid),
    y: snap(input.y, grid),
    width: snap(input.width, grid),
    height: snap(input.height, grid),
  };
  nextPlan.furniture.push(item);
  return result(brief, nextPlan, `Added ${item.name} in ${item.roomId}.`);
}

export function commandRemoveFurniture(
  brief: Brief,
  plan: FloorPlan,
  id: string,
): CommandResult {
  const nextPlan = clonePlan(plan);
  const before = nextPlan.furniture.length;
  nextPlan.furniture = nextPlan.furniture.filter((item) => item.id !== id);
  if (nextPlan.furniture.length === before) {
    return result(brief, plan, `No furniture with id ${id}.`);
  }
  return result(brief, nextPlan, `Removed furniture ${id}.`);
}

function wallCoordinate(room: Room, edge: Edge) {
  switch (edge) {
    case "west":
      return room.x;
    case "east":
      return room.x + room.width;
    case "north":
      return room.y;
    case "south":
      return room.y + room.height;
  }
}

export function commandResizeWall(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof resizeWallInputSchema>,
): CommandResult {
  const room = plan.rooms.find((item) => item.id === input.roomId);
  if (!room) {
    return result(brief, plan, `No room with id ${input.roomId}.`);
  }
  const current = wallCoordinate(room, input.edge);
  const position = input.position ?? current + (input.delta ?? 0);
  const nextPlan = resizeRoomWall(plan, input.roomId, input.edge, position);
  const nextRoom = nextPlan.rooms.find((item) => item.id === room.id);
  if (!nextRoom) {
    return result(brief, nextPlan, `Moved ${input.edge} wall of ${room.name}.`);
  }
  return result(
    brief,
    nextPlan,
    `Moved ${room.name} ${input.edge} wall to ${wallCoordinate(nextRoom, input.edge)} m (${nextRoom.width}×${nextRoom.height} m). Shared neighbors moved with it.`,
  );
}

export function commandReplaceFurniture(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof replaceFurnitureInputSchema>,
): CommandResult {
  const item = plan.furniture.find((entry) => entry.id === input.id);
  if (!item) {
    return result(brief, plan, `No furniture with id ${input.id}.`);
  }
  const nextPlan = replaceFurniture(plan, input.id, input.kind);
  const next = nextPlan.furniture.find((entry) => entry.id === input.id);
  return result(
    brief,
    nextPlan,
    next
      ? `Replaced ${item.name} with ${next.name} (${next.width}×${next.height} m).`
      : `Replaced furniture ${input.id}.`,
  );
}

export function commandMoveFurniture(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof moveFurnitureInputSchema>,
): CommandResult {
  const item = plan.furniture.find((entry) => entry.id === input.id);
  if (!item) {
    return result(brief, plan, `No furniture with id ${input.id}.`);
  }
  const nextPlan = moveFurniture(plan, input.id, input.x, input.y);
  const next = nextPlan.furniture.find((entry) => entry.id === input.id);
  return result(
    brief,
    nextPlan,
    next
      ? `Moved ${next.name} to ${next.x}, ${next.y} m in ${next.roomId}.`
      : `Moved furniture ${input.id}.`,
  );
}

export function commandResizeFurniture(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof resizeFurnitureInputSchema>,
): CommandResult {
  const item = plan.furniture.find((entry) => entry.id === input.id);
  if (!item) {
    return result(brief, plan, `No furniture with id ${input.id}.`);
  }
  const nextPlan = resizeFurniture(plan, input.id, input.width, input.height);
  const next = nextPlan.furniture.find((entry) => entry.id === input.id);
  return result(
    brief,
    nextPlan,
    next
      ? `Resized ${next.name} to ${next.width}×${next.height} m.`
      : `Resized furniture ${input.id}.`,
  );
}

export function commandReplaceOpening(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof replaceOpeningInputSchema>,
): CommandResult {
  const opening = plan.openings.find((entry) => entry.id === input.id);
  if (!opening) {
    return result(brief, plan, `No opening with id ${input.id}.`);
  }
  const nextPlan = replaceOpening(plan, input.id, input.kind);
  return result(
    brief,
    nextPlan,
    `Changed ${opening.id} from ${opening.kind} to ${input.kind}.`,
  );
}

export function commandMoveOpening(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof moveOpeningInputSchema>,
): CommandResult {
  const opening = plan.openings.find((entry) => entry.id === input.id);
  if (!opening) {
    return result(brief, plan, `No opening with id ${input.id}.`);
  }
  const nextPlan = moveOpening(plan, input.id, input.offset, input.edge);
  const next = nextPlan.openings.find((entry) => entry.id === input.id);
  return result(
    brief,
    nextPlan,
    next
      ? `Moved ${next.kind} ${next.id} to ${next.offset} m on the ${next.edge} wall of ${next.roomId}.`
      : `Moved opening ${input.id}.`,
  );
}

export function commandResizeOpening(
  brief: Brief,
  plan: FloorPlan,
  input: z.infer<typeof resizeOpeningInputSchema>,
): CommandResult {
  const opening = plan.openings.find((entry) => entry.id === input.id);
  if (!opening) {
    return result(brief, plan, `No opening with id ${input.id}.`);
  }
  const nextPlan = resizeOpening(plan, input.id, input.width);
  const next = nextPlan.openings.find((entry) => entry.id === input.id);
  return result(
    brief,
    nextPlan,
    next
      ? `Resized ${next.kind} ${next.id} to ${next.width} m.`
      : `Resized opening ${input.id}.`,
  );
}

export function commandGetFloorPlan(brief: Brief, plan: FloorPlan): CommandResult {
  const issues = validatePlan(plan);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return result(
    brief,
    plan,
    errors
      ? `Plan has ${plan.rooms.length} rooms and ${errors} error(s) to fix.`
      : `Plan has ${plan.rooms.length} rooms, ${plan.openings.length} openings, ${plan.furniture.length} furniture items.`,
  );
}

export function commandExportPlan(
  brief: Brief,
  plan: FloorPlan,
  format: ExportFormat,
  filename?: string,
): CommandResult {
  const snapshot = result(brief, plan, "");
  if (plan.rooms.length === 0) {
    return {
      ...snapshot,
      summary: "Nothing to export yet — draw a layout first.",
    };
  }
  const file = {
    format,
    filename: sanitizeExportFilename(filename, format),
  };
  return {
    ...snapshot,
    exportFile: file,
    summary: `Ready to download ${file.filename}.`,
  };
}

export function commandGenerate3d(
  brief: Brief,
  plan: FloorPlan,
  filename?: string,
): CommandResult {
  const snapshot = result(brief, plan, "");
  if (plan.rooms.length === 0) {
    return {
      ...snapshot,
      summary: "Nothing to generate yet — draw a layout first.",
    };
  }
  const file = sanitizeExportFilename(filename, "glb");
  return {
    ...snapshot,
    view3d: { filename: file },
    summary: `Opened a 3D dollhouse of the current plan. The user can orbit it and download ${file}.`,
  };
}
