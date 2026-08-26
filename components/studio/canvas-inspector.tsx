"use client";

import { Copy, Layers2, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FURNITURE_CATALOG } from "@/lib/floor-plan/furniture-catalog";
import { ROOM_TYPES, type OpeningKind, type RoomType } from "@/lib/floor-plan/types";
import {
  displayToMeters,
  formatLength,
  formatMeasure,
  type DisplayUnit,
} from "@/lib/floor-plan/units";
import { useStudioStore } from "@/lib/store/use-studio-store";

const ADD_ROOM_TYPES: RoomType[] = [
  "living",
  "bedroom",
  "bathroom",
  "kitchen",
  "dining",
  "hallway",
  "office",
  "closet",
  "laundry",
  "balcony",
  "porch",
  "stairs",
  "other",
];

function roomLabel(type: RoomType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function MeasureField({
  id,
  label,
  meters,
  unit,
  onCommit,
}: {
  id: string;
  label: string;
  meters: number;
  unit: DisplayUnit;
  onCommit: (meters: number) => void;
}) {
  function commit(raw: string, input: HTMLInputElement) {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = formatMeasure(meters, unit);
      return;
    }
    onCommit(displayToMeters(parsed, unit));
  }

  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {label}
      <Input
        key={`${id}-${unit}-${meters}`}
        className="h-6 w-14 px-1.5 text-xs"
        defaultValue={formatMeasure(meters, unit)}
        onBlur={(event) => commit(event.target.value, event.target)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        inputMode="decimal"
        aria-label={label}
      />
      <span>{unit}</span>
    </label>
  );
}

function HistoryButtons() {
  const undo = useStudioStore((state) => state.undo);
  const redo = useStudioStore((state) => state.redo);
  const canUndo = useStudioStore((state) => state.past.length > 0);
  const canRedo = useStudioStore((state) => state.future.length > 0);
  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={!canUndo}
        onClick={undo}
        title="Undo (⌘Z)"
      >
        <Undo2 data-icon="inline-start" />
        Undo
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={!canRedo}
        onClick={redo}
        title="Redo (⌘⇧Z)"
      >
        <Redo2 data-icon="inline-start" />
        Redo
      </Button>
    </>
  );
}

function ClipboardButtons() {
  const clipboard = useStudioStore((state) => state.clipboard);
  const copySelected = useStudioStore((state) => state.copySelected);
  const pasteClipboard = useStudioStore((state) => state.pasteClipboard);
  const duplicateSelected = useStudioStore((state) => state.duplicateSelected);
  return (
    <>
      <Button type="button" size="xs" variant="outline" onClick={copySelected}>
        <Copy data-icon="inline-start" />
        Copy
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={duplicateSelected}>
        <Layers2 data-icon="inline-start" />
        Duplicate
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={!clipboard}
        onClick={pasteClipboard}
      >
        Paste
      </Button>
    </>
  );
}

function PlotSizeFields() {
  const plan = useStudioStore((state) => state.plan);
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const setPlot = useStudioStore((state) => state.setPlot);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">Plot</span>
      <MeasureField
        id="plot-w"
        label="W"
        meters={plan.plot.width}
        unit={displayUnit}
        onCommit={(width) => setPlot(width, plan.plot.height)}
      />
      <MeasureField
        id="plot-h"
        label="H"
        meters={plan.plot.height}
        unit={displayUnit}
        onCommit={(height) => setPlot(plan.plot.width, height)}
      />
    </div>
  );
}

function AddRoomButtons() {
  const addRoom = useStudioStore((state) => state.addRoom);
  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium text-muted-foreground">Add room</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {ADD_ROOM_TYPES.filter((type) => ROOM_TYPES.includes(type)).map((type) => (
          <Button
            key={type}
            type="button"
            size="xs"
            variant="outline"
            onClick={() => addRoom(type)}
          >
            {roomLabel(type)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function CanvasInspector() {
  const plan = useStudioStore((state) => state.plan);
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const selectedRoomId = useStudioStore((state) => state.selectedRoomId);
  const selectedFurnitureId = useStudioStore((state) => state.selectedFurnitureId);
  const selectedOpeningId = useStudioStore((state) => state.selectedOpeningId);
  const placingOpeningKind = useStudioStore((state) => state.placingOpeningKind);
  const replaceSelectedFurniture = useStudioStore(
    (state) => state.replaceSelectedFurniture,
  );
  const renameSelectedFurniture = useStudioStore(
    (state) => state.renameSelectedFurniture,
  );
  const resizeSelectedFurniture = useStudioStore(
    (state) => state.resizeSelectedFurniture,
  );
  const removeSelectedFurniture = useStudioStore(
    (state) => state.removeSelectedFurniture,
  );
  const replaceSelectedOpening = useStudioStore(
    (state) => state.replaceSelectedOpening,
  );
  const removeSelectedOpening = useStudioStore((state) => state.removeSelectedOpening);
  const setPlacingOpeningKind = useStudioStore((state) => state.setPlacingOpeningKind);
  const renameSelectedRoom = useStudioStore((state) => state.renameSelectedRoom);
  const resizeSelectedRoom = useStudioStore((state) => state.resizeSelectedRoom);
  const removeSelectedRoom = useStudioStore((state) => state.removeSelectedRoom);
  const addFurnitureInRoom = useStudioStore((state) => state.addFurnitureInRoom);
  const setSelectedFurnitureId = useStudioStore((state) => state.setSelectedFurnitureId);
  const setSelectedOpeningId = useStudioStore((state) => state.setSelectedOpeningId);
  const clipboard = useStudioStore((state) => state.clipboard);
  const pasteClipboard = useStudioStore((state) => state.pasteClipboard);

  const room = plan.rooms.find((item) => item.id === selectedRoomId);
  const furniture = plan.furniture.find((item) => item.id === selectedFurnitureId);
  const opening = plan.openings.find((item) => item.id === selectedOpeningId);

  function placeKind(kind: OpeningKind) {
    setPlacingOpeningKind(placingOpeningKind === kind ? null : kind);
  }

  if (furniture) {
    return (
      <div className="pointer-events-auto max-w-xl rounded-xl border bg-background/95 p-3 shadow-sm">
        <Input
          className="h-7 text-xs font-medium"
          value={furniture.name}
          onChange={(event) => renameSelectedFurniture(event.target.value)}
          aria-label="Object name"
          placeholder="Object name"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Drag to move · corner to resize · ⌘Z undo · ⌘C / ⌘V copy
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MeasureField
            id={`${furniture.id}-w`}
            label="W"
            meters={furniture.width}
            unit={displayUnit}
            onCommit={(width) => resizeSelectedFurniture(width, furniture.height)}
          />
          <MeasureField
            id={`${furniture.id}-h`}
            label="H"
            meters={furniture.height}
            unit={displayUnit}
            onCommit={(height) => resizeSelectedFurniture(furniture.width, height)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {FURNITURE_CATALOG.map((preset) => (
            <Button
              key={preset.kind}
              type="button"
              size="xs"
              variant={preset.kind === furniture.kind ? "default" : "outline"}
              onClick={() => replaceSelectedFurniture(preset.kind)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <HistoryButtons />
          <ClipboardButtons />
          <Button
            type="button"
            size="xs"
            variant="destructive"
            onClick={() => removeSelectedFurniture()}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  if (opening) {
    return (
      <div className="pointer-events-auto rounded-xl border bg-background/95 p-3 shadow-sm">
        <p className="text-xs font-medium">
          {opening.kind} ({formatLength(opening.width, displayUnit)})
          <span className="ml-1 font-normal text-muted-foreground">
            · drag along the wall · ends to resize
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button
            type="button"
            size="xs"
            variant={opening.kind === "door" ? "default" : "outline"}
            onClick={() => replaceSelectedOpening("door")}
          >
            Door
          </Button>
          <Button
            type="button"
            size="xs"
            variant={opening.kind === "window" ? "default" : "outline"}
            onClick={() => replaceSelectedOpening("window")}
          >
            Window
          </Button>
          <HistoryButtons />
          <ClipboardButtons />
          <Button
            type="button"
            size="xs"
            variant="destructive"
            onClick={() => removeSelectedOpening()}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  if (placingOpeningKind) {
    return (
      <div className="pointer-events-auto rounded-xl border bg-background/95 p-3 shadow-sm">
        <p className="text-xs font-medium">
          Click a wall to place a {placingOpeningKind}
          <span className="ml-1 font-normal text-muted-foreground">· Esc to cancel</span>
        </p>
        <div className="mt-2 flex gap-1">
          <Button
            type="button"
            size="xs"
            variant={placingOpeningKind === "door" ? "default" : "outline"}
            onClick={() => placeKind("door")}
          >
            Door
          </Button>
          <Button
            type="button"
            size="xs"
            variant={placingOpeningKind === "window" ? "default" : "outline"}
            onClick={() => placeKind("window")}
          >
            Window
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setPlacingOpeningKind(null)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (room) {
    const roomFurniture = plan.furniture.filter((item) => item.roomId === room.id);
    const roomOpenings = plan.openings.filter((item) => item.roomId === room.id);
    return (
      <div className="pointer-events-auto max-w-xl rounded-xl border bg-background/95 p-3 shadow-sm">
        <Input
          className="h-7 text-xs font-medium"
          value={room.name}
          onChange={(event) => renameSelectedRoom(event.target.value)}
          aria-label="Room name"
          placeholder="Room name"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Drag room to move · walls to resize · ⌘Z undo
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MeasureField
            id={`${room.id}-w`}
            label="W"
            meters={room.width}
            unit={displayUnit}
            onCommit={(width) => resizeSelectedRoom(width, room.height)}
          />
          <MeasureField
            id={`${room.id}-h`}
            label="H"
            meters={room.height}
            unit={displayUnit}
            onCommit={(height) => resizeSelectedRoom(room.width, height)}
          />
        </div>
        {roomFurniture.length + roomOpenings.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {roomFurniture.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setSelectedFurnitureId(item.id)}
              >
                {item.name}
              </Button>
            ))}
            {roomOpenings.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setSelectedOpeningId(item.id)}
              >
                {item.kind}
              </Button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">Add to room</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <HistoryButtons />
          <ClipboardButtons />
          <Button type="button" size="xs" variant="outline" onClick={() => placeKind("door")}>
            Door
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => placeKind("window")}
          >
            Window
          </Button>
          {FURNITURE_CATALOG.map((preset) => (
            <Button
              key={preset.kind}
              type="button"
              size="xs"
              variant="outline"
              onClick={() => addFurnitureInRoom(room.id, preset.kind)}
            >
              {preset.name}
            </Button>
          ))}
          <Button
            type="button"
            size="xs"
            variant="destructive"
            onClick={() => removeSelectedRoom()}
          >
            Remove room
          </Button>
        </div>
        <div className="mt-3 border-t pt-2">
          <PlotSizeFields />
          <AddRoomButtons />
        </div>
      </div>
    );
  }

  if (plan.rooms.length > 0) {
    return (
      <div className="pointer-events-auto max-w-xl rounded-xl border bg-background/95 p-3 shadow-sm">
        <p className="text-xs text-muted-foreground">
          Click a room to rename or furnish it. Drag a room to move it. ⌘Z undo · ⌘⇧Z redo ·
          ⌘C / ⌘V copy.
        </p>
        <div className="mt-2">
          <PlotSizeFields />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <HistoryButtons />
          <Button type="button" size="xs" variant="outline" onClick={() => placeKind("door")}>
            Add door
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => placeKind("window")}
          >
            Add window
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!clipboard}
            onClick={pasteClipboard}
          >
            Paste
          </Button>
        </div>
        <AddRoomButtons />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto max-w-xl rounded-xl border bg-background/95 p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">
        Set the plot size, add rooms, or ask the agent to draft a layout.
      </p>
      <div className="mt-2">
        <PlotSizeFields />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <HistoryButtons />
      </div>
      <AddRoomButtons />
    </div>
  );
}
