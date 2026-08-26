"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent,
  type ReactElement,
} from "react";
import { Scan } from "lucide-react";
import { CanvasInspector } from "@/components/studio/canvas-inspector";
import { ExportButtons } from "@/components/studio/export-buttons";
import { BlockSizeSlider } from "@/components/studio/block-size-slider";
import { LayerToggles } from "@/components/studio/layer-toggles";
import { Button } from "@/components/ui/button";
import { useCanvasPanZoom } from "@/hooks/use-canvas-pan-zoom";
import { planViewBox, roomFill } from "@/lib/floor-plan/plan-svg";
import type {
  Edge,
  FloorPlan,
  FurnitureItem,
  Opening,
  OpeningKind,
  Room,
  Street,
} from "@/lib/floor-plan/types";
import { EDGES } from "@/lib/floor-plan/types";
import { isBlockLine } from "@/lib/floor-plan/defaults";
import { SIDEWALK_WIDTH } from "@/lib/floor-plan/site-defaults";
import { formatLength, formatSize, SCALE_BAR_METERS, type DisplayUnit } from "@/lib/floor-plan/units";
import { useStudioStore } from "@/lib/store/use-studio-store";
import { cn } from "@/lib/utils";

const HANDLE = 0.18;

function StairTreads({ room }: { room: Room }) {
  const vertical = room.height >= room.width;
  const span = vertical ? room.height : room.width;
  const count = Math.max(5, Math.round(span / 0.28));
  const lines: ReactElement[] = [];
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    if (vertical) {
      const y = room.y + t * room.height;
      lines.push(
        <line
          key={i}
          x1={room.x + 0.08}
          y1={y}
          x2={room.x + room.width - 0.08}
          y2={y}
          stroke="#5c564c"
          strokeWidth={0.03}
        />,
      );
    } else {
      const x = room.x + t * room.width;
      lines.push(
        <line
          key={i}
          x1={x}
          y1={room.y + 0.08}
          x2={x}
          y2={room.y + room.height - 0.08}
          stroke="#5c564c"
          strokeWidth={0.03}
        />,
      );
    }
  }
  const arrow = vertical
    ? `${room.x + room.width / 2},${room.y + 0.2} ${room.x + room.width / 2 - 0.12},${room.y + 0.42} ${room.x + room.width / 2 + 0.12},${room.y + 0.42}`
    : `${room.x + 0.2},${room.y + room.height / 2} ${room.x + 0.42},${room.y + room.height / 2 - 0.12} ${room.x + 0.42},${room.y + room.height / 2 + 0.12}`;
  return (
    <g className="pointer-events-none">
      {lines}
      <polygon points={arrow} fill="#3f3b36" />
    </g>
  );
}

function StreetBand({ plot, street }: { plot: FloorPlan["plot"]; street: Street }) {
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
      label = { x: plot.width / 2, y: plot.height + walk + road / 2 - 0.15, rotate: 0 };
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
      label = { x: plot.width / 2, y: -walk - road / 2 - 0.15, rotate: 0 };
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
  return (
    <g className="pointer-events-none">
      <rect
        x={sidewalk.x}
        y={sidewalk.y}
        width={sidewalk.w}
        height={sidewalk.h}
        fill="#d9d3c7"
      />
      <rect
        x={carriage.x}
        y={carriage.y}
        width={carriage.w}
        height={carriage.h}
        fill="#8b8680"
      />
      <line
        x1={dash.x1}
        y1={dash.y1}
        x2={dash.x2}
        y2={dash.y2}
        stroke="#f4efe4"
        strokeWidth={0.08}
        strokeDasharray="0.55 0.35"
      />
      <text
        x={label.x}
        y={label.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={0.38}
        fontWeight={600}
        fill="#f7f4ee"
        transform={`rotate(${label.rotate} ${label.x} ${label.y})`}
      >
        STREET
      </text>
    </g>
  );
}

function clientToMeters(clientX: number, clientY: number, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  return {
    x: ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x,
    y: ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y,
  };
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

function doorSwing(room: Room, opening: Opening) {
  const geo = edgeGeometry(room, opening);
  const midX = (geo.x1 + geo.x2) / 2;
  const midY = (geo.y1 + geo.y2) / 2;
  const hingeX = geo.x1;
  const hingeY = geo.y1;
  const r = opening.width;
  switch (opening.edge) {
    case "north":
      return { cx: hingeX, cy: hingeY, d: `M ${hingeX} ${hingeY} L ${hingeX} ${hingeY + r} A ${r} ${r} 0 0 0 ${hingeX + r} ${hingeY}` };
    case "south":
      return { cx: hingeX, cy: hingeY, d: `M ${hingeX} ${hingeY} L ${hingeX} ${hingeY - r} A ${r} ${r} 0 0 1 ${hingeX + r} ${hingeY}` };
    case "west":
      return { cx: hingeX, cy: hingeY, d: `M ${hingeX} ${hingeY} L ${hingeX + r} ${hingeY} A ${r} ${r} 0 0 1 ${hingeX} ${hingeY + r}` };
    case "east":
      return { cx: hingeX, cy: hingeY, d: `M ${hingeX} ${hingeY} L ${hingeX - r} ${hingeY} A ${r} ${r} 0 0 0 ${hingeX} ${hingeY + r}` };
    default:
      return { cx: midX, cy: midY, d: "" };
  }
}

function offsetAlongEdge(room: Room, edge: Edge, x: number, y: number) {
  return edge === "north" || edge === "south" ? x - room.x : y - room.y;
}

function distToEdge(room: Room, edge: Edge, x: number, y: number) {
  switch (edge) {
    case "north":
      return Math.abs(y - room.y);
    case "south":
      return Math.abs(y - (room.y + room.height));
    case "west":
      return Math.abs(x - room.x);
    case "east":
      return Math.abs(x - (room.x + room.width));
  }
}

function edgeAtPointer(room: Room, x: number, y: number, fallback: Edge): Edge {
  let best = fallback;
  let bestD = distToEdge(room, fallback, x, y);
  for (const edge of EDGES) {
    const d = distToEdge(room, edge, x, y);
    if (d < 0.55 && d + 0.02 < bestD) {
      best = edge;
      bestD = d;
    }
  }
  return best;
}

function interiorNormal(edge: Edge) {
  switch (edge) {
    case "north":
      return { x: 0, y: 1 };
    case "south":
      return { x: 0, y: -1 };
    case "west":
      return { x: 1, y: 0 };
    case "east":
      return { x: -1, y: 0 };
  }
}

function Grid({ width, height, step }: { width: number; height: number; step: number }) {
  const lines: ReactElement[] = [];
  const increment = step >= 0.5 ? step / 2 : step;
  for (let x = 0; x <= width + 0.001; x += increment) {
    const block = isBlockLine(x, step);
    lines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={block ? "#d4d0c8" : "#eceae4"}
        strokeWidth={block ? 0.03 : 0.015}
      />,
    );
  }
  for (let y = 0; y <= height + 0.001; y += increment) {
    const block = isBlockLine(y, step);
    lines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={block ? "#d4d0c8" : "#eceae4"}
        strokeWidth={block ? 0.03 : 0.015}
      />,
    );
  }
  return <g className="pointer-events-none">{lines}</g>;
}

function WallHandles({
  room,
  mode,
  onEdgePointerDown,
}: {
  room: Room;
  mode: "resize" | "place";
  onEdgePointerDown: (edge: Edge, event: PointerEvent<SVGRectElement>) => void;
}) {
  const placing = mode === "place";
  const handles: { edge: Edge; x: number; y: number; w: number; h: number; cursor: string }[] = [
    { edge: "north", x: room.x, y: room.y - HANDLE / 2, w: room.width, h: HANDLE, cursor: placing ? "crosshair" : "ns-resize" },
    { edge: "south", x: room.x, y: room.y + room.height - HANDLE / 2, w: room.width, h: HANDLE, cursor: placing ? "crosshair" : "ns-resize" },
    { edge: "west", x: room.x - HANDLE / 2, y: room.y, w: HANDLE, h: room.height, cursor: placing ? "crosshair" : "ew-resize" },
    { edge: "east", x: room.x + room.width - HANDLE / 2, y: room.y, w: HANDLE, h: room.height, cursor: placing ? "crosshair" : "ew-resize" },
  ];
  return (
    <g>
      {handles.map((handle) => (
        <rect
          key={handle.edge}
          data-edit={placing ? "opening-place" : "wall"}
          x={handle.x}
          y={handle.y}
          width={handle.w}
          height={handle.h}
          fill={placing ? "#1d4ed8" : "#1f1b16"}
          fillOpacity={placing ? 0.28 : 0.18}
          className="pointer-events-auto"
          style={{ cursor: handle.cursor }}
          onPointerDown={(event) => onEdgePointerDown(handle.edge, event)}
        />
      ))}
    </g>
  );
}

function FurnitureBlock({
  room,
  item,
  selected,
  onSelect,
  onMoveStart,
  onResizeStart,
}: {
  room: Room;
  item: FurnitureItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onMoveStart: (event: PointerEvent<SVGGElement>) => void;
  onResizeStart: (event: PointerEvent<SVGRectElement>) => void;
}) {
  const handle = Math.min(0.2, item.width * 0.35, item.height * 0.35);
  return (
    <g
      data-edit="furniture"
      transform={`translate(${room.x + item.x} ${room.y + item.y})`}
      className="cursor-move"
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(item.id);
        onMoveStart(event);
      }}
    >
      <rect
        width={item.width}
        height={item.height}
        fill="#fff"
        fillOpacity={0.85}
        stroke={selected ? "#1d4ed8" : "#5c564c"}
        strokeWidth={selected ? 0.08 : 0.04}
        rx={0.08}
      />
      <text
        x={item.width / 2}
        y={item.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={Math.min(0.28, item.width * 0.28)}
        fill="#3f3b36"
        className="pointer-events-none"
      >
        {item.name}
      </text>
      {selected ? (
        <rect
          data-edit="furniture-resize"
          x={item.width - handle}
          y={item.height - handle}
          width={handle}
          height={handle}
          fill="#1d4ed8"
          className="cursor-nwse-resize"
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect(item.id);
            onResizeStart(event);
          }}
        />
      ) : null}
    </g>
  );
}

function OpeningMark({
  room,
  opening,
  selected,
  onSelect,
  onMoveStart,
  onResizeStart,
}: {
  room: Room;
  opening: Opening;
  selected: boolean;
  onSelect: (id: string) => void;
  onMoveStart: (event: PointerEvent<SVGGElement>) => void;
  onResizeStart: (end: "start" | "end", event: PointerEvent<SVGRectElement>) => void;
}) {
  const geo = edgeGeometry(room, opening);
  const isWindow = opening.kind === "window";
  const swing = isWindow ? null : doorSwing(room, opening);
  const normal = interiorNormal(opening.edge);
  const handle = 0.16;
  const startX = geo.x1 + normal.x * 0.12 - handle / 2;
  const startY = geo.y1 + normal.y * 0.12 - handle / 2;
  const endX = geo.x2 + normal.x * 0.12 - handle / 2;
  const endY = geo.y2 + normal.y * 0.12 - handle / 2;
  const alongCursor =
    opening.edge === "north" || opening.edge === "south" ? "ew-resize" : "ns-resize";
  return (
    <g
      data-edit="opening"
      className={selected ? "cursor-grab" : "cursor-pointer"}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(opening.id);
        onMoveStart(event);
      }}
    >
      <line
        x1={geo.x1}
        y1={geo.y1}
        x2={geo.x2}
        y2={geo.y2}
        stroke="transparent"
        strokeWidth={0.28}
      />
      <line
        x1={geo.x1}
        y1={geo.y1}
        x2={geo.x2}
        y2={geo.y2}
        stroke={isWindow ? (selected ? "#1d4ed8" : "#f7f4ee") : "#f7f4ee"}
        strokeWidth={isWindow ? 0.18 : 0.2}
      />
      {isWindow ? (
        <line
          x1={geo.x1}
          y1={geo.y1}
          x2={geo.x2}
          y2={geo.y2}
          stroke={selected ? "#1d4ed8" : "#3d6ea8"}
          strokeWidth={0.06}
        />
      ) : (
        <path
          d={swing?.d}
          fill="none"
          stroke={selected ? "#1d4ed8" : "#3f3b36"}
          strokeWidth={0.04}
        />
      )}
      {selected ? (
        <>
          <rect
            data-edit="opening-resize"
            x={startX}
            y={startY}
            width={handle}
            height={handle}
            fill="#1d4ed8"
            className="pointer-events-auto"
            style={{ cursor: alongCursor }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect(opening.id);
              onResizeStart("start", event);
            }}
          />
          <rect
            data-edit="opening-resize"
            x={endX}
            y={endY}
            width={handle}
            height={handle}
            fill="#1d4ed8"
            className="pointer-events-auto"
            style={{ cursor: alongCursor }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect(opening.id);
              onResizeStart("end", event);
            }}
          />
        </>
      ) : null}
    </g>
  );
}

function RoomBlock({
  room,
  selected,
  displayUnit,
  fill,
  onSelect,
  onMoveStart,
}: {
  room: Room;
  selected: boolean;
  displayUnit: DisplayUnit;
  fill: string;
  onSelect: (id: string) => void;
  onMoveStart: (event: PointerEvent<SVGGElement>) => void;
}) {
  return (
    <g
      data-room={room.id}
      data-edit="room"
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(room.id);
        onMoveStart(event);
      }}
      className="cursor-grab"
    >
      <rect
        x={room.x}
        y={room.y}
        width={room.width}
        height={room.height}
        fill={fill}
        stroke={selected ? "#1f1b16" : "#3f3b36"}
        strokeWidth={selected ? 0.1 : 0.06}
      />
      {room.type === "stairs" ? <StairTreads room={room} /> : null}
      <text
        x={room.x + room.width / 2}
        y={room.y + room.height / 2 - 0.18}
        textAnchor="middle"
        fontSize={0.42}
        fontWeight={600}
        fill="#1f1b16"
        className="pointer-events-none"
      >
        {room.name.trim() || "Room"}
      </text>
      <text
        x={room.x + room.width / 2}
        y={room.y + room.height / 2 + 0.28}
        textAnchor="middle"
        fontSize={0.28}
        fill="#5c564c"
        className="pointer-events-none"
      >
        {formatSize(room.width, room.height, displayUnit)}
      </text>
    </g>
  );
}

type DragState =
  | { type: "wall"; roomId: string; edge: Edge }
  | {
      type: "room";
      roomId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | { type: "furniture"; startX: number; startY: number; origX: number; origY: number }
  | {
      type: "furniture-resize";
      startX: number;
      startY: number;
      origW: number;
      origH: number;
    }
  | { type: "opening"; openingId: string; roomId: string; grabT: number }
  | {
      type: "opening-resize";
      openingId: string;
      roomId: string;
      edge: Edge;
      end: "start" | "end";
      origOffset: number;
      origWidth: number;
    };

function PlanSvg({
  plan,
  selectedRoomId,
  selectedFurnitureId,
  selectedOpeningId,
  placingOpeningKind,
}: {
  plan: FloorPlan;
  selectedRoomId: string | null;
  selectedFurnitureId: string | null;
  selectedOpeningId: string | null;
  placingOpeningKind: OpeningKind | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState | null>(null);
  const setSelectedRoomId = useStudioStore((state) => state.setSelectedRoomId);
  const setSelectedFurnitureId = useStudioStore((state) => state.setSelectedFurnitureId);
  const setSelectedOpeningId = useStudioStore((state) => state.setSelectedOpeningId);
  const clearSelection = useStudioStore((state) => state.clearSelection);
  const resizeWall = useStudioStore((state) => state.resizeWall);
  const moveSelectedRoom = useStudioStore((state) => state.moveSelectedRoom);
  const moveSelectedFurniture = useStudioStore((state) => state.moveSelectedFurniture);
  const resizeSelectedFurniture = useStudioStore(
    (state) => state.resizeSelectedFurniture,
  );
  const addOpeningOnWall = useStudioStore((state) => state.addOpeningOnWall);
  const beginHistoryGesture = useStudioStore((state) => state.beginHistoryGesture);
  const endHistoryGesture = useStudioStore((state) => state.endHistoryGesture);
  const moveSelectedOpening = useStudioStore((state) => state.moveSelectedOpening);
  const resizeSelectedOpening = useStudioStore((state) => state.resizeSelectedOpening);

  function startDrag(next: DragState) {
    beginHistoryGesture();
    drag.current = next;
  }

  const displayUnit = useStudioStore((state) => state.displayUnit);
  const showRoomColors = useStudioStore((state) => state.showRoomColors);
  const showDoors = useStudioStore((state) => state.showDoors);
  const showObjects = useStudioStore((state) => state.showObjects);
  const roomsById = useMemo(
    () => new Map(plan.rooms.map((room) => [room.id, room])),
    [plan.rooms],
  );
  const pad = 1.25;
  const width = plan.plot.width;
  const height = plan.plot.height;
  const street = plan.street;
  const streetExtra = street ? street.width + SIDEWALK_WIDTH + 0.35 : 0;
  const padN = pad + (street?.edge === "north" ? streetExtra : 0);
  const padS = pad + (street?.edge === "south" ? streetExtra : 0);
  const padW = pad + (street?.edge === "west" ? streetExtra : 0);
  const padE = pad + (street?.edge === "east" ? streetExtra : 0);
  const scaleOnSouth = street?.edge !== "south";
  const compassOnEast = street?.edge !== "east";
  const selectedRoom = plan.rooms.find((room) => room.id === selectedRoomId);

  useEffect(() => {
    function onMove(event: globalThis.PointerEvent) {
      const current = drag.current;
      if (!current || !svgRef.current) return;
      const meters = clientToMeters(event.clientX, event.clientY, svgRef.current);
      if (current.type === "wall") {
        const position =
          current.edge === "east" || current.edge === "west" ? meters.x : meters.y;
        resizeWall(current.roomId, current.edge, position);
        return;
      }
      if (current.type === "room") {
        moveSelectedRoom(
          current.origX + (meters.x - current.startX),
          current.origY + (meters.y - current.startY),
          current.roomId,
        );
        return;
      }
      if (current.type === "furniture-resize") {
        resizeSelectedFurniture(
          current.origW + (meters.x - current.startX),
          current.origH + (meters.y - current.startY),
        );
        return;
      }
      if (current.type === "furniture") {
        moveSelectedFurniture(
          current.origX + (meters.x - current.startX),
          current.origY + (meters.y - current.startY),
        );
        return;
      }
      const live = useStudioStore.getState();
      if (current.type === "opening") {
        const opening = live.plan.openings.find((item) => item.id === current.openingId);
        const room = live.plan.rooms.find((item) => item.id === current.roomId);
        if (!opening || !room) return;
        const edge = edgeAtPointer(room, meters.x, meters.y, opening.edge);
        const along = offsetAlongEdge(room, edge, meters.x, meters.y);
        moveSelectedOpening(along - current.grabT * opening.width, edge);
        return;
      }
      const opening = live.plan.openings.find((item) => item.id === current.openingId);
      const room = live.plan.rooms.find((item) => item.id === current.roomId);
      if (!opening || !room) return;
      const along = offsetAlongEdge(room, current.edge, meters.x, meters.y);
      if (current.end === "start") {
        const finish = current.origOffset + current.origWidth;
        resizeSelectedOpening(finish - along, along);
      } else {
        resizeSelectedOpening(along - current.origOffset, current.origOffset);
      }
    }
    function onUp() {
      if (drag.current) endHistoryGesture();
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    endHistoryGesture,
    moveSelectedFurniture,
    moveSelectedOpening,
    moveSelectedRoom,
    resizeSelectedFurniture,
    resizeSelectedOpening,
    resizeWall,
  ]);

  return (
    <svg
      ref={svgRef}
      viewBox={`${-padW} ${-padN} ${width + padW + padE} ${height + padN + padS + 0.8}`}
      width={width + padW + padE}
      height={height + padN + padS + 0.8}
      className="overflow-visible"
      onPointerDown={(event) => {
        const target = event.target as Element;
        if (target.closest("[data-edit], [data-room]")) return;
        clearSelection();
      }}
    >
      {street ? <StreetBand plot={plan.plot} street={street} /> : null}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#f7f4ee"
        stroke="#1f1b16"
        strokeWidth={0.08}
      />
      <Grid width={width} height={height} step={plan.gridSize} />
      {plan.rooms.map((room) => (
        <RoomBlock
          key={room.id}
          room={room}
          selected={selectedRoomId === room.id}
          displayUnit={displayUnit}
          fill={roomFill(room.type, showRoomColors)}
          onSelect={setSelectedRoomId}
          onMoveStart={(event) => {
            if (placingOpeningKind) return;
            const svg = svgRef.current;
            if (!svg) return;
            const meters = clientToMeters(event.clientX, event.clientY, svg);
            startDrag({
              type: "room",
              roomId: room.id,
              startX: meters.x,
              startY: meters.y,
              origX: room.x,
              origY: room.y,
            });
          }}
        />
      ))}
      {(showObjects ? plan.furniture : []).map((item) => {
        const room = roomsById.get(item.roomId);
        if (!room) return null;
        return (
          <FurnitureBlock
            key={item.id}
            room={room}
            item={item}
            selected={selectedFurnitureId === item.id}
            onSelect={setSelectedFurnitureId}
            onMoveStart={(event) => {
              const svg = svgRef.current;
              if (!svg) return;
              const meters = clientToMeters(event.clientX, event.clientY, svg);
              startDrag({
                type: "furniture",
                startX: meters.x,
                startY: meters.y,
                origX: item.x,
                origY: item.y,
              });
            }}
            onResizeStart={(event) => {
              const svg = svgRef.current;
              if (!svg) return;
              const meters = clientToMeters(event.clientX, event.clientY, svg);
              startDrag({
                type: "furniture-resize",
                startX: meters.x,
                startY: meters.y,
                origW: item.width,
                origH: item.height,
              });
            }}
          />
        );
      })}
      {placingOpeningKind
        ? null
        : selectedRoom ? (
            <WallHandles
              room={selectedRoom}
              mode="resize"
              onEdgePointerDown={(edge, event) => {
                event.preventDefault();
                event.stopPropagation();
                startDrag({ type: "wall", roomId: selectedRoom.id, edge });
              }}
            />
          ) : null}
      {plan.openings.map((opening) => {
        if (!showDoors && opening.kind === "door") return null;
        const room = roomsById.get(opening.roomId);
        if (!room) return null;
        return (
          <OpeningMark
            key={opening.id}
            room={room}
            opening={opening}
            selected={selectedOpeningId === opening.id}
            onSelect={setSelectedOpeningId}
            onMoveStart={(event) => {
              if (placingOpeningKind) return;
              const svg = svgRef.current;
              if (!svg) return;
              const meters = clientToMeters(event.clientX, event.clientY, svg);
              const along = offsetAlongEdge(room, opening.edge, meters.x, meters.y);
              const width = Math.max(opening.width, 0.01);
              startDrag({
                type: "opening",
                openingId: opening.id,
                roomId: room.id,
                grabT: (along - opening.offset) / width,
              });
            }}
            onResizeStart={(end) => {
              if (placingOpeningKind) return;
              startDrag({
                type: "opening-resize",
                openingId: opening.id,
                roomId: room.id,
                edge: opening.edge,
                end,
                origOffset: opening.offset,
                origWidth: opening.width,
              });
            }}
          />
        );
      })}
      {placingOpeningKind
        ? plan.rooms.map((room) => (
            <WallHandles
              key={`place-${room.id}`}
              room={room}
              mode="place"
              onEdgePointerDown={(edge, event) => {
                event.preventDefault();
                event.stopPropagation();
                const svg = svgRef.current;
                if (!svg) return;
                const meters = clientToMeters(event.clientX, event.clientY, svg);
                addOpeningOnWall(
                  room.id,
                  edge,
                  placingOpeningKind,
                  offsetAlongEdge(room, edge, meters.x, meters.y),
                );
              }}
            />
          ))
        : null}
      <g transform={`translate(0 ${scaleOnSouth ? height + 0.45 : -0.7})`}>
        <line x1={0} y1={0} x2={SCALE_BAR_METERS} y2={0} stroke="#1f1b16" strokeWidth={0.05} />
        <line x1={0} y1={-0.12} x2={0} y2={0.12} stroke="#1f1b16" strokeWidth={0.05} />
        <line
          x1={SCALE_BAR_METERS}
          y1={-0.12}
          x2={SCALE_BAR_METERS}
          y2={0.12}
          stroke="#1f1b16"
          strokeWidth={0.05}
        />
        <text
          x={SCALE_BAR_METERS / 2}
          y={0.38}
          textAnchor="middle"
          fontSize={0.28}
          fill="#3f3b36"
        >
          {formatLength(SCALE_BAR_METERS, displayUnit)}
        </text>
      </g>
      <g transform={`translate(${compassOnEast ? width + 0.35 : -0.55} 0.2)`}>
        <polygon points="0,0 0.18,0.55 -0.18,0.55" fill="#1f1b16" />
        <text x={0} y={0.82} textAnchor="middle" fontSize={0.28} fill="#1f1b16">
          N
        </text>
      </g>
    </svg>
  );
}

export function FloorPlanCanvas() {
  const plan = useStudioStore((state) => state.plan);
  const selectedRoomId = useStudioStore((state) => state.selectedRoomId);
  const selectedFurnitureId = useStudioStore((state) => state.selectedFurnitureId);
  const selectedOpeningId = useStudioStore((state) => state.selectedOpeningId);
  const placingOpeningKind = useStudioStore((state) => state.placingOpeningKind);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { offset, scale, centerView, onPointerDown, onPointerMove, onPointerUp } =
    useCanvasPanZoom(viewportRef);
  const { vbWidth, vbHeight } = planViewBox(plan);

  const centerGrid = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    centerView(rect.width, rect.height, vbWidth, vbHeight);
  }, [centerView, vbHeight, vbWidth]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().width >= 1) {
      centerGrid();
      return;
    }
    const observer = new ResizeObserver(() => {
      if (el.getBoundingClientRect().width < 1) return;
      centerGrid();
      observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [centerGrid]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const state = useStudioStore.getState();
      if (event.key === "Escape") {
        if (state.placingOpeningKind) {
          state.setPlacingOpeningKind(null);
          return;
        }
        state.clearSelection();
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (meta && key === "c") {
        if (state.selectedFurnitureId || state.selectedOpeningId || state.selectedRoomId) {
          event.preventDefault();
          state.copySelected();
        }
        return;
      }
      if (meta && key === "v") {
        if (state.clipboard) {
          event.preventDefault();
          state.pasteClipboard();
        }
        return;
      }
      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (meta && key === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (meta && key === "d") {
        if (state.selectedFurnitureId || state.selectedOpeningId || state.selectedRoomId) {
          event.preventDefault();
          state.duplicateSelected();
        }
        return;
      }
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (state.selectedOpeningId) {
        event.preventDefault();
        state.removeSelectedOpening();
        return;
      }
      if (state.selectedFurnitureId) {
        event.preventDefault();
        state.removeSelectedFurniture();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#efeae1]">
      <div
        ref={viewportRef}
        className={cn("min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width: "fit-content",
          }}
        >
          <PlanSvg
            plan={plan}
            selectedRoomId={selectedRoomId}
            selectedFurnitureId={selectedFurnitureId}
            selectedOpeningId={selectedOpeningId}
            placingOpeningKind={placingOpeningKind}
          />
        </div>
      </div>
      {plan.rooms.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            Describe a home in chat. Rooms will appear here.
          </p>
        </div>
      ) : null}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-2">
        <BlockSizeSlider />
        <LayerToggles className="pointer-events-auto rounded-xl bg-background/95 px-2 py-1.5 shadow-sm" />
      </div>
      <div className="pointer-events-none absolute top-3 right-3">
        <ExportButtons />
      </div>
      <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-3">
        <CanvasInspector />
        <div className="flex flex-col items-end gap-2">
          {plan.rooms.length > 0 ? (
            <p className="hidden rounded-xl bg-background/80 px-3 py-2 text-xs text-muted-foreground sm:block">
              Scroll to zoom · drag rooms to move · ⌘Z undo · ⌘⇧Z redo · ⌘C / ⌘V copy
            </p>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="pointer-events-auto rounded-xl border bg-background/95 shadow-sm"
            aria-label="Center grid in the canvas"
            title="Center grid"
            onClick={centerGrid}
          >
            <Scan data-icon="inline-start" />
            Center
          </Button>
        </div>
      </div>
    </div>
  );
}
