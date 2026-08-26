import type { FurnitureItem, Room } from "./types";

const EPS = 0.02;

export function roomArea(room: Room): number {
  return room.width * room.height;
}

export function roomMinSide(room: Room): number {
  return Math.min(room.width, room.height);
}

export function roomsOverlap(a: Room, b: Room, eps = EPS): boolean {
  return (
    a.x + eps < b.x + b.width &&
    b.x + eps < a.x + a.width &&
    a.y + eps < b.y + b.height &&
    b.y + eps < a.y + a.height
  );
}

export function furnitureFitsInRoom(room: Room, item: FurnitureItem, eps = EPS): boolean {
  return (
    item.x >= -eps &&
    item.y >= -eps &&
    item.x + item.width <= room.width + eps &&
    item.y + item.height <= room.height + eps
  );
}

export function translateRoom(room: Room, dx: number, dy: number): void {
  room.x += dx;
  room.y += dy;
}

export function cloneRoomDeep(room: Room): Room {
  return { ...room };
}

function overlap1d(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** Shared edge length between two rooms. */
export function sharedEdgeLengthParts(a: Room, b: Room): number {
  const verticalTouch =
    Math.abs(a.x + a.width - b.x) < EPS || Math.abs(b.x + b.width - a.x) < EPS;
  if (verticalTouch) {
    return overlap1d(a.y, a.y + a.height, b.y, b.y + b.height);
  }
  const horizontalTouch =
    Math.abs(a.y + a.height - b.y) < EPS || Math.abs(b.y + b.height - a.y) < EPS;
  if (horizontalTouch) {
    return overlap1d(a.x, a.x + a.width, b.x, b.x + b.width);
  }
  return 0;
}
