import { isBlockLine } from "./defaults";
import { SIDEWALK_WIDTH } from "./site-defaults";
import type { Edge, FloorPlan, Opening, Room, RoomType, Street } from "./types";
import { formatLength, formatSize, SCALE_BAR_METERS, type DisplayUnit } from "./units";
import type { DisplayLayers } from "./layers";
import { DEFAULT_DISPLAY_LAYERS } from "./layers";

export const ROOM_NEUTRAL_FILL = "#f7f4ee";

export const ROOM_FILL: Record<RoomType, string> = {
  bedroom: "#c5d7ef",
  bathroom: "#cfe6dc",
  kitchen: "#f3d3c2",
  living: "#eadcc6",
  dining: "#e6d3b3",
  hallway: "#e6e2d8",
  closet: "#ddd6cc",
  balcony: "#c9e4d6",
  office: "#d9d3ee",
  laundry: "#d4e0ea",
  stairs: "#d7cfc4",
  porch: "#efe4c9",
  other: "#e2e2e2",
};

export function roomFill(type: RoomType, showColors = true) {
  if (!showColors) return ROOM_NEUTRAL_FILL;
  return ROOM_FILL[type] ?? "#e2e2e2";
}

export const PX_PER_METER = 48;

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function planViewBox(plan: FloorPlan) {
  const pad = 1.25;
  const width = plan.plot.width;
  const height = plan.plot.height;
  const street = plan.street;
  const streetExtra = street ? street.width + SIDEWALK_WIDTH + 0.35 : 0;
  const padN = pad + (street?.edge === "north" ? streetExtra : 0);
  const padS = pad + (street?.edge === "south" ? streetExtra : 0);
  const padW = pad + (street?.edge === "west" ? streetExtra : 0);
  const padE = pad + (street?.edge === "east" ? streetExtra : 0);
  const vbWidth = width + padW + padE;
  const vbHeight = height + padN + padS + 0.8;
  return { padN, padS, padW, padE, vbX: -padW, vbY: -padN, vbWidth, vbHeight, width, height };
}

function gridLines(width: number, height: number, step: number) {
  const lines: string[] = [];
  const increment = step >= 0.5 ? step / 2 : step;
  for (let x = 0; x <= width + 0.001; x += increment) {
    const block = isBlockLine(x, step);
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${block ? "#d4d0c8" : "#eceae4"}" stroke-width="${block ? 0.03 : 0.015}" />`,
    );
  }
  for (let y = 0; y <= height + 0.001; y += increment) {
    const block = isBlockLine(y, step);
    lines.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${block ? "#d4d0c8" : "#eceae4"}" stroke-width="${block ? 0.03 : 0.015}" />`,
    );
  }
  return lines.join("");
}

function streetSvg(plot: FloorPlan["plot"], street: Street) {
  const walk = SIDEWALK_WIDTH;
  const road = street.width;
  const over = 0.5;
  let sidewalk: { x: number; y: number; w: number; h: number };
  let carriage: { x: number; y: number; w: number; h: number };
  let dash: { x1: number; y1: number; x2: number; y2: number };
  let label: { x: number; y: number; rotate: number };
  switch (street.edge) {
    case "south":
      sidewalk = { x: -over, y: plot.height, w: plot.width + over * 2, h: walk };
      carriage = { x: -over, y: plot.height + walk, w: plot.width + over * 2, h: road };
      dash = {
        x1: 0.3,
        y1: plot.height + walk + road / 2,
        x2: plot.width - 0.3,
        y2: plot.height + walk + road / 2,
      };
      label = { x: plot.width / 2, y: plot.height + walk + road / 2, rotate: 0 };
      break;
    case "north":
      sidewalk = { x: -over, y: -walk, w: plot.width + over * 2, h: walk };
      carriage = { x: -over, y: -walk - road, w: plot.width + over * 2, h: road };
      dash = {
        x1: 0.3,
        y1: -walk - road / 2,
        x2: plot.width - 0.3,
        y2: -walk - road / 2,
      };
      label = { x: plot.width / 2, y: -walk - road / 2, rotate: 0 };
      break;
    case "west":
      sidewalk = { x: -walk, y: -over, w: walk, h: plot.height + over * 2 };
      carriage = { x: -walk - road, y: -over, w: road, h: plot.height + over * 2 };
      dash = {
        x1: -walk - road / 2,
        y1: 0.3,
        x2: -walk - road / 2,
        y2: plot.height - 0.3,
      };
      label = { x: -walk - road / 2, y: plot.height / 2, rotate: -90 };
      break;
    case "east":
      sidewalk = { x: plot.width, y: -over, w: walk, h: plot.height + over * 2 };
      carriage = { x: plot.width + walk, y: -over, w: road, h: plot.height + over * 2 };
      dash = {
        x1: plot.width + walk + road / 2,
        y1: 0.3,
        x2: plot.width + walk + road / 2,
        y2: plot.height - 0.3,
      };
      label = { x: plot.width + walk + road / 2, y: plot.height / 2, rotate: 90 };
      break;
  }
  return `<g>
    <rect x="${sidewalk.x}" y="${sidewalk.y}" width="${sidewalk.w}" height="${sidewalk.h}" fill="#d9d3c7" />
    <rect x="${carriage.x}" y="${carriage.y}" width="${carriage.w}" height="${carriage.h}" fill="#8b8680" />
    <line x1="${dash.x1}" y1="${dash.y1}" x2="${dash.x2}" y2="${dash.y2}" stroke="#f4efe4" stroke-width="0.08" stroke-dasharray="0.55 0.35" />
    <text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" font-size="0.38" font-weight="600" fill="#f7f4ee" transform="rotate(${label.rotate} ${label.x} ${label.y})">STREET</text>
  </g>`;
}

function stairTreads(room: Room) {
  const vertical = room.height >= room.width;
  const span = vertical ? room.height : room.width;
  const count = Math.max(5, Math.round(span / 0.28));
  const lines: string[] = [];
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    if (vertical) {
      const y = room.y + t * room.height;
      lines.push(
        `<line x1="${room.x + 0.08}" y1="${y}" x2="${room.x + room.width - 0.08}" y2="${y}" stroke="#5c564c" stroke-width="0.03" />`,
      );
    } else {
      const x = room.x + t * room.width;
      lines.push(
        `<line x1="${x}" y1="${room.y + 0.08}" x2="${x}" y2="${room.y + room.height - 0.08}" stroke="#5c564c" stroke-width="0.03" />`,
      );
    }
  }
  const arrow = vertical
    ? `${room.x + room.width / 2},${room.y + 0.2} ${room.x + room.width / 2 - 0.12},${room.y + 0.42} ${room.x + room.width / 2 + 0.12},${room.y + 0.42}`
    : `${room.x + 0.2},${room.y + room.height / 2} ${room.x + 0.42},${room.y + room.height / 2 - 0.12} ${room.x + 0.42},${room.y + room.height / 2 + 0.12}`;
  return `${lines.join("")}<polygon points="${arrow}" fill="#3f3b36" />`;
}

function edgeGeometry(room: Room, opening: Opening) {
  const { offset, width } = opening;
  switch (opening.edge as Edge) {
    case "north":
      return { x1: room.x + offset, y1: room.y, x2: room.x + offset + width, y2: room.y };
    case "south":
      return {
        x1: room.x + offset,
        y1: room.y + room.height,
        x2: room.x + offset + width,
        y2: room.y + room.height,
      };
    case "west":
      return { x1: room.x, y1: room.y + offset, x2: room.x, y2: room.y + offset + width };
    case "east":
      return {
        x1: room.x + room.width,
        y1: room.y + offset,
        x2: room.x + room.width,
        y2: room.y + offset + width,
      };
  }
}

function doorPath(room: Room, opening: Opening) {
  const geo = edgeGeometry(room, opening);
  const hingeX = geo.x1;
  const hingeY = geo.y1;
  const r = opening.width;
  switch (opening.edge) {
    case "north":
      return `M ${hingeX} ${hingeY} L ${hingeX} ${hingeY + r} A ${r} ${r} 0 0 0 ${hingeX + r} ${hingeY}`;
    case "south":
      return `M ${hingeX} ${hingeY} L ${hingeX} ${hingeY - r} A ${r} ${r} 0 0 1 ${hingeX + r} ${hingeY}`;
    case "west":
      return `M ${hingeX} ${hingeY} L ${hingeX + r} ${hingeY} A ${r} ${r} 0 0 1 ${hingeX} ${hingeY + r}`;
    case "east":
      return `M ${hingeX} ${hingeY} L ${hingeX - r} ${hingeY} A ${r} ${r} 0 0 0 ${hingeX} ${hingeY + r}`;
    default:
      return "";
  }
}

export function renderPlanSvg(
  plan: FloorPlan,
  displayUnit: DisplayUnit = "m",
  layers: DisplayLayers = DEFAULT_DISPLAY_LAYERS,
) {
  const { vbX, vbY, vbWidth, vbHeight, width, height } = planViewBox(plan);
  const roomsById = new Map(plan.rooms.map((room) => [room.id, room]));
  const street = plan.street;
  const scaleOnSouth = street?.edge !== "south";
  const compassOnEast = street?.edge !== "east";
  const pxW = Math.round(vbWidth * PX_PER_METER);
  const pxH = Math.round(vbHeight * PX_PER_METER);

  const rooms = plan.rooms
    .map((room) => {
      const fill = roomFill(room.type, layers.roomColors);
      const treads = room.type === "stairs" ? stairTreads(room) : "";
      return `<g>
        <rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}" fill="${fill}" stroke="#3f3b36" stroke-width="0.06" />
        ${treads}
        <text x="${room.x + room.width / 2}" y="${room.y + room.height / 2 - 0.18}" text-anchor="middle" font-size="0.42" font-weight="600" fill="#1f1b16">${esc(room.name)}</text>
        <text x="${room.x + room.width / 2}" y="${room.y + room.height / 2 + 0.28}" text-anchor="middle" font-size="0.28" fill="#5c564c">${esc(formatSize(room.width, room.height, displayUnit))}</text>
      </g>`;
    })
    .join("");

  const furniture = layers.objects
    ? plan.furniture
        .map((item) => {
          const room = roomsById.get(item.roomId);
          if (!room) return "";
          const x = room.x + item.x;
          const y = room.y + item.y;
          const font = Math.min(0.28, item.width * 0.28);
          return `<g transform="translate(${x} ${y})">
        <rect width="${item.width}" height="${item.height}" fill="#fff" fill-opacity="0.85" stroke="#5c564c" stroke-width="0.04" rx="0.08" />
        <text x="${item.width / 2}" y="${item.height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${font}" fill="#3f3b36">${esc(item.name)}</text>
      </g>`;
        })
        .join("")
    : "";

  const openings = plan.openings
    .filter((opening) => layers.doors || opening.kind !== "door")
    .map((opening) => {
      const room = roomsById.get(opening.roomId);
      if (!room) return "";
      const geo = edgeGeometry(room, opening);
      const isWindow = opening.kind === "window";
      const swing = isWindow ? "" : `<path d="${doorPath(room, opening)}" fill="none" stroke="#3f3b36" stroke-width="0.04" />`;
      const extra = isWindow
        ? `<line x1="${geo.x1}" y1="${geo.y1}" x2="${geo.x2}" y2="${geo.y2}" stroke="#3d6ea8" stroke-width="0.06" />`
        : "";
      return `<g>
        <line x1="${geo.x1}" y1="${geo.y1}" x2="${geo.x2}" y2="${geo.y2}" stroke="#f7f4ee" stroke-width="${isWindow ? 0.18 : 0.2}" />
        ${extra}${swing}
      </g>`;
    })
    .join("");

  const scaleY = scaleOnSouth ? height + 0.45 : -0.7;
  const compassX = compassOnEast ? width + 0.35 : -0.55;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbWidth} ${vbHeight}" width="${pxW}" height="${pxH}" font-family="system-ui, sans-serif">
  <rect x="${vbX}" y="${vbY}" width="${vbWidth}" height="${vbHeight}" fill="#efeae1" />
  ${street ? streetSvg(plan.plot, street) : ""}
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f7f4ee" stroke="#1f1b16" stroke-width="0.08" />
  ${gridLines(width, height, plan.gridSize)}
  ${rooms}
  ${furniture}
  ${openings}
  <g transform="translate(0 ${scaleY})">
    <line x1="0" y1="0" x2="${SCALE_BAR_METERS}" y2="0" stroke="#1f1b16" stroke-width="0.05" />
    <line x1="0" y1="-0.12" x2="0" y2="0.12" stroke="#1f1b16" stroke-width="0.05" />
    <line x1="${SCALE_BAR_METERS}" y1="-0.12" x2="${SCALE_BAR_METERS}" y2="0.12" stroke="#1f1b16" stroke-width="0.05" />
    <text x="${SCALE_BAR_METERS / 2}" y="0.38" text-anchor="middle" font-size="0.28" fill="#3f3b36">${esc(formatLength(SCALE_BAR_METERS, displayUnit))}</text>
  </g>
  <g transform="translate(${compassX} 0.2)">
    <polygon points="0,0 0.18,0.55 -0.18,0.55" fill="#1f1b16" />
    <text x="0" y="0.82" text-anchor="middle" font-size="0.28" fill="#1f1b16">N</text>
  </g>
</svg>`;
}

export function planPixelSize(plan: FloorPlan) {
  const { vbWidth, vbHeight } = planViewBox(plan);
  return {
    width: Math.round(vbWidth * PX_PER_METER),
    height: Math.round(vbHeight * PX_PER_METER),
  };
}
