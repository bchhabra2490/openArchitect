import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UIMessage } from "ai";
import {
  commandAddFurniture,
  commandAddOpening,
  commandAddRoom,
  commandRemoveFurniture,
  commandRemoveOpening,
  commandRemoveRoom,
  commandSetPlot,
  commandUpdateRoom,
} from "@/lib/floor-plan/commands";
import { emptyBrief, emptyPlan, nearestBlockSize, normalizePlan } from "@/lib/floor-plan/defaults";
import { cloneRoomDeep, translateRoom } from "@/lib/floor-plan/geometry";
import { uniqueId } from "@/lib/floor-plan/ids";
import {
  defaultOpeningWidth,
  defaultRoomFootprint,
  findFreeRoomPlacement,
  moveFurniture,
  moveOpening,
  moveRoom,
  placeFurnitureInRoom,
  renameFurniture,
  renameRoom,
  replaceFurniture,
  replaceOpening,
  resizeFurniture,
  resizeOpening,
  resizeRoomWall,
} from "@/lib/floor-plan/edit";
import { furniturePreset } from "@/lib/floor-plan/furniture-catalog";
import type {
  Brief,
  ClarifyingQuestion,
  CommandResult,
  Edge,
  FloorPlan,
  OpeningKind,
  PlanExport,
  RoomType,
  StudioClipboard,
} from "@/lib/floor-plan/types";
import { isDisplayLayers } from "@/lib/floor-plan/layers";
import { isDisplayUnit, type DisplayUnit } from "@/lib/floor-plan/units";
import {
  captureHistory,
  cloneClipboard,
  normalizeHistoryList,
  plansMatch,
  pushHistory,
  resetHistoryClock,
  restoreHistory,
  type HistorySnapshot,
} from "@/lib/store/history";

export type WebMcpStatus = "unknown" | "available" | "unavailable";
export type QuestionSource = "chat" | "webmcp" | null;

type StudioState = {
  brief: Brief;
  plan: FloorPlan;
  selectedRoomId: string | null;
  selectedFurnitureId: string | null;
  selectedOpeningId: string | null;
  placingOpeningKind: OpeningKind | null;
  measureMode: boolean;
  clipboard: StudioClipboard | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  historyGesture: boolean;
  pendingQuestions: ClarifyingQuestion[] | null;
  questionSource: QuestionSource;
  webmcpStatus: WebMcpStatus;
  pendingExport: (PlanExport & { id: number }) | null;
  chatMessages: UIMessage[];
  displayUnit: DisplayUnit;
  showRoomColors: boolean;
  showDoors: boolean;
  showObjects: boolean;
  applyResult: (
    result: Pick<CommandResult, "brief" | "plan" | "exportFile" | "view3d" | "displayLayers">,
  ) => void;
  setChatMessages: (messages: UIMessage[]) => void;
  setDisplayUnit: (unit: DisplayUnit) => void;
  setShowRoomColors: (show: boolean) => void;
  setShowDoors: (show: boolean) => void;
  setShowObjects: (show: boolean) => void;
  setGridSize: (meters: number) => void;
  clearPendingExport: () => void;
  view3dOpen: boolean;
  view3dFilename: string;
  openView3d: (filename?: string) => void;
  closeView3d: () => void;
  setSelectedRoomId: (id: string | null) => void;
  setSelectedFurnitureId: (id: string | null) => void;
  setSelectedOpeningId: (id: string | null) => void;
  resizeWall: (roomId: string, edge: Edge, position: number) => void;
  moveSelectedRoom: (x: number, y: number, roomId?: string) => void;
  renameSelectedRoom: (name: string) => void;
  resizeSelectedRoom: (width: number, height: number) => void;
  setSelectedRoomColor: (color: string | null) => void;
  removeSelectedRoom: () => void;
  setPlot: (width: number, height: number) => void;
  addRoom: (type: RoomType) => void;
  addFurnitureInRoom: (roomId: string, kind: string) => void;
  replaceSelectedFurniture: (kind: string) => void;
  moveSelectedFurniture: (x: number, y: number) => void;
  resizeSelectedFurniture: (width: number, height: number) => void;
  renameSelectedFurniture: (name: string) => void;
  removeSelectedFurniture: () => void;
  replaceSelectedOpening: (kind: OpeningKind) => void;
  setPlacingOpeningKind: (kind: OpeningKind | null) => void;
  setMeasureMode: (on: boolean) => void;
  addOpeningOnWall: (roomId: string, edge: Edge, kind: OpeningKind, along: number) => void;
  moveSelectedOpening: (offset: number, edge?: Edge) => void;
  resizeSelectedOpening: (width: number, offset?: number) => void;
  removeSelectedOpening: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  beginHistoryGesture: () => void;
  endHistoryGesture: () => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  setPendingQuestions: (
    questions: ClarifyingQuestion[] | null,
    source?: QuestionSource,
  ) => void;
  chatReplyHandler: ((text: string) => void) | null;
  setChatReplyHandler: (handler: ((text: string) => void) | null) => void;
  waitForAnswers: (
    questions: ClarifyingQuestion[],
    signal?: AbortSignal,
  ) => Promise<Record<string, string>>;
  submitAnswers: (answers: Record<string, string>) => void;
  setWebmcpStatus: (status: WebMcpStatus) => void;
  importProject: (brief: Brief, plan: FloorPlan) => void;
  reset: () => void;
  /** Bumps when the studio is reset so chat/canvas can remount. */
  sessionKey: number;
};

type PendingWaiter = {
  resolve: (answers: Record<string, string>) => void;
  reject: (error: Error) => void;
};

let waiter: PendingWaiter | null = null;
let exportSeq = 0;

function commitPlan(
  get: () => StudioState,
  plan: FloorPlan,
  extra: Partial<StudioState> = {},
  meta?: { coalesce?: boolean },
): Partial<StudioState> {
  const state = get();
  const patch: Partial<StudioState> = {
    ...extra,
    plan,
  };
  if (state.historyGesture) return patch;
  const history = pushHistory(state.past, captureHistory(state), Boolean(meta?.coalesce));
  return { ...patch, ...history };
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      brief: emptyBrief(),
      plan: emptyPlan(),
      selectedRoomId: null,
      selectedFurnitureId: null,
      selectedOpeningId: null,
      placingOpeningKind: null,
      measureMode: false,
      clipboard: null,
      past: [],
      future: [],
      historyGesture: false,
      pendingQuestions: null,
      questionSource: null,
      chatReplyHandler: null,
      webmcpStatus: "unknown",
      pendingExport: null,
      view3dOpen: false,
      view3dFilename: "floor-plan.glb",
      chatMessages: [],
      displayUnit: "m",
      showRoomColors: true,
      showDoors: true,
      showObjects: true,
      sessionKey: 0,
      applyResult: (result) => {
        if (result.displayLayers) {
          const layers = result.displayLayers;
          if (layers.roomColors !== undefined) get().setShowRoomColors(layers.roomColors);
          if (layers.doors !== undefined) get().setShowDoors(layers.doors);
          if (layers.objects !== undefined) get().setShowObjects(layers.objects);
        }
        const { selectedRoomId, selectedFurnitureId, selectedOpeningId } = get();
        const plan = normalizePlan(result.plan);
        const onlyLayers =
          Boolean(result.displayLayers) &&
          plansMatch(get().plan, plan) &&
          !result.exportFile &&
          !result.view3d;
        if (onlyLayers) return;
        set(
          commitPlan(get, plan, {
            brief: result.brief,
            selectedRoomId: plan.rooms.some((room) => room.id === selectedRoomId)
              ? selectedRoomId
              : null,
            selectedFurnitureId: plan.furniture.some(
              (item) => item.id === selectedFurnitureId,
            )
              ? selectedFurnitureId
              : null,
            selectedOpeningId: plan.openings.some(
              (opening) => opening.id === selectedOpeningId,
            )
              ? selectedOpeningId
              : null,
            pendingExport: result.exportFile
              ? { ...result.exportFile, id: ++exportSeq }
              : get().pendingExport,
            view3dOpen: result.view3d ? true : get().view3dOpen,
            view3dFilename: result.view3d?.filename ?? get().view3dFilename,
          }),
        );
      },
      clearPendingExport: () => set({ pendingExport: null }),
      openView3d: (filename) =>
        set({
          view3dOpen: true,
          view3dFilename: filename ?? "floor-plan.glb",
        }),
      closeView3d: () => set({ view3dOpen: false }),
      setChatMessages: (messages) => set({ chatMessages: messages }),
      setDisplayUnit: (unit) => set({ displayUnit: unit }),
      setShowRoomColors: (show) => set({ showRoomColors: show }),
      setShowDoors: (show) => {
        const selected = get().plan.openings.find(
          (opening) => opening.id === get().selectedOpeningId,
        );
        set({
          showDoors: show,
          selectedOpeningId:
            !show && selected?.kind === "door" ? null : get().selectedOpeningId,
        });
      },
      setShowObjects: (show) =>
        set({
          showObjects: show,
          selectedFurnitureId: show ? get().selectedFurnitureId : null,
        }),
      setGridSize: (meters) => {
        const gridSize = nearestBlockSize(meters);
        set(commitPlan(get, { ...get().plan, gridSize }, {}, { coalesce: true }));
      },
      setSelectedRoomId: (id) =>
        set({
          selectedRoomId: id,
          selectedFurnitureId: null,
          selectedOpeningId: null,
        }),
      setSelectedFurnitureId: (id) =>
        set({
          selectedFurnitureId: id,
          selectedRoomId: null,
          selectedOpeningId: null,
          placingOpeningKind: null,
          showObjects: id ? true : get().showObjects,
        }),
      setSelectedOpeningId: (id) => {
        const opening = get().plan.openings.find((item) => item.id === id);
        set({
          selectedOpeningId: id,
          selectedFurnitureId: null,
          selectedRoomId: null,
          placingOpeningKind: null,
          showDoors: opening?.kind === "door" ? true : get().showDoors,
        });
      },
      resizeWall: (roomId, edge, position) => {
        set(commitPlan(get, resizeRoomWall(get().plan, roomId, edge, position)));
      },
      moveSelectedRoom: (x, y, roomId) => {
        const id = roomId ?? get().selectedRoomId;
        if (!id) return;
        set(commitPlan(get, moveRoom(get().plan, id, x, y)));
      },
      renameSelectedRoom: (name) => {
        const id = get().selectedRoomId;
        if (!id) return;
        set(commitPlan(get, renameRoom(get().plan, id, name), {}, { coalesce: true }));
      },
      resizeSelectedRoom: (width, height) => {
        const id = get().selectedRoomId;
        if (!id) return;
        const { brief, plan } = get();
        const room = plan.rooms.find((entry) => entry.id === id);
        if (!room) return;
        const min = 0.01;
        const result = commandUpdateRoom(brief, plan, {
          id,
          width: Math.min(width, Math.max(min, plan.plot.width - room.x)),
          height: Math.min(height, Math.max(min, plan.plot.height - room.y)),
        });
        set(commitPlan(get, result.plan, { brief: result.brief }));
      },
      setSelectedRoomColor: (color) => {
        const id = get().selectedRoomId;
        if (!id) return;
        const { brief, plan, showRoomColors } = get();
        const result = commandUpdateRoom(brief, plan, { id, color });
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            ...(color && !showRoomColors ? { showRoomColors: true } : {}),
          }),
        );
      },
      removeSelectedRoom: () => {
        const id = get().selectedRoomId;
        if (!id) return;
        const { brief, plan } = get();
        const result = commandRemoveRoom(brief, plan, id);
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedRoomId: null,
            selectedFurnitureId: null,
            selectedOpeningId: null,
          }),
        );
      },
      setPlot: (width, height) => {
        const { brief, plan } = get();
        const result = commandSetPlot(brief, plan, { width, height });
        set(commitPlan(get, result.plan, { brief: result.brief }));
      },
      addRoom: (type) => {
        const { brief, plan } = get();
        const footprint = defaultRoomFootprint(type);
        const placement = findFreeRoomPlacement(plan, footprint.width, footprint.height);
        const existing = new Set(plan.rooms.map((room) => room.id));
        const result = commandAddRoom(brief, plan, {
          name: footprint.name,
          type,
          x: placement.x,
          y: placement.y,
          width: footprint.width,
          height: footprint.height,
        });
        const added = result.plan.rooms.find((room) => !existing.has(room.id));
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedRoomId: added?.id ?? null,
            selectedFurnitureId: null,
            selectedOpeningId: null,
            placingOpeningKind: null,
          }),
        );
      },
      addFurnitureInRoom: (roomId, kind) => {
        const { brief, plan } = get();
        const room = plan.rooms.find((entry) => entry.id === roomId);
        if (!room) return;
        const preset = furniturePreset(kind);
        const placed = placeFurnitureInRoom(
          room,
          plan.furniture,
          preset,
          plan.gridSize,
        );
        const existing = new Set(plan.furniture.map((item) => item.id));
        const result = commandAddFurniture(brief, plan, {
          roomId,
          name: preset.name,
          kind: preset.kind,
          x: placed.x,
          y: placed.y,
          width: placed.width,
          height: placed.height,
        });
        const added = result.plan.furniture.find((item) => !existing.has(item.id));
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedRoomId: null,
            selectedOpeningId: null,
            selectedFurnitureId: added?.id ?? null,
            placingOpeningKind: null,
            showObjects: true,
          }),
        );
      },
      replaceSelectedFurniture: (kind) => {
        const id = get().selectedFurnitureId;
        if (!id) return;
        set(commitPlan(get, replaceFurniture(get().plan, id, kind)));
      },
      moveSelectedFurniture: (x, y) => {
        const id = get().selectedFurnitureId;
        if (!id) return;
        set(commitPlan(get, moveFurniture(get().plan, id, x, y)));
      },
      resizeSelectedFurniture: (width, height) => {
        const id = get().selectedFurnitureId;
        if (!id) return;
        set(commitPlan(get, resizeFurniture(get().plan, id, width, height)));
      },
      renameSelectedFurniture: (name) => {
        const id = get().selectedFurnitureId;
        if (!id) return;
        set(commitPlan(get, renameFurniture(get().plan, id, name), {}, { coalesce: true }));
      },
      removeSelectedFurniture: () => {
        const id = get().selectedFurnitureId;
        if (!id) return;
        const result = commandRemoveFurniture(get().brief, get().plan, id);
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedFurnitureId: null,
          }),
        );
      },
      replaceSelectedOpening: (kind) => {
        const id = get().selectedOpeningId;
        if (!id) return;
        set(commitPlan(get, replaceOpening(get().plan, id, kind)));
      },
      setPlacingOpeningKind: (kind) =>
        set({
          placingOpeningKind: kind,
          measureMode: kind ? false : get().measureMode,
          selectedFurnitureId: null,
          selectedOpeningId: null,
          showDoors: kind === "door" ? true : get().showDoors,
        }),
      setMeasureMode: (on) =>
        set({
          measureMode: on,
          placingOpeningKind: on ? null : get().placingOpeningKind,
          selectedFurnitureId: on ? null : get().selectedFurnitureId,
          selectedOpeningId: on ? null : get().selectedOpeningId,
          selectedRoomId: on ? null : get().selectedRoomId,
        }),
      addOpeningOnWall: (roomId, edge, kind, along) => {
        const { brief, plan } = get();
        const room = plan.rooms.find((entry) => entry.id === roomId);
        if (!room) return;
        const width = defaultOpeningWidth(kind, room, plan.gridSize);
        const existing = new Set(plan.openings.map((opening) => opening.id));
        const result = commandAddOpening(brief, plan, {
          kind,
          roomId,
          edge,
          offset: along - width / 2,
          width,
        });
        const added = result.plan.openings.find((opening) => !existing.has(opening.id));
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedRoomId: null,
            selectedFurnitureId: null,
            selectedOpeningId: added?.id ?? null,
            placingOpeningKind: null,
            showDoors: kind === "door" ? true : get().showDoors,
          }),
        );
      },
      moveSelectedOpening: (offset, edge) => {
        const id = get().selectedOpeningId;
        if (!id) return;
        set(commitPlan(get, moveOpening(get().plan, id, offset, edge)));
      },
      resizeSelectedOpening: (width, offset) => {
        const id = get().selectedOpeningId;
        if (!id) return;
        set(commitPlan(get, resizeOpening(get().plan, id, width, offset)));
      },
      removeSelectedOpening: () => {
        const id = get().selectedOpeningId;
        if (!id) return;
        const result = commandRemoveOpening(get().brief, get().plan, id);
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedOpeningId: null,
          }),
        );
      },
      copySelected: () => {
        const { plan, selectedFurnitureId, selectedOpeningId, selectedRoomId } = get();
        if (selectedFurnitureId) {
          const item = plan.furniture.find((entry) => entry.id === selectedFurnitureId);
          if (item) set({ clipboard: { type: "furniture", item: { ...item } } });
          return;
        }
        if (selectedOpeningId) {
          const opening = plan.openings.find((entry) => entry.id === selectedOpeningId);
          if (opening) set({ clipboard: { type: "opening", opening: { ...opening } } });
          return;
        }
        if (selectedRoomId) {
          const room = plan.rooms.find((entry) => entry.id === selectedRoomId);
          if (!room) return;
          set({
            clipboard: {
              type: "room",
              room: cloneRoomDeep(room),
              openings: plan.openings
                .filter((opening) => opening.roomId === room.id)
                .map((opening) => ({ ...opening })),
              furniture: plan.furniture
                .filter((item) => item.roomId === room.id)
                .map((item) => ({ ...item })),
            },
          });
        }
      },
      pasteClipboard: () => {
        const { brief, plan, clipboard, selectedRoomId, selectedFurnitureId } = get();
        if (!clipboard) return;

        if (clipboard.type === "room") {
          const ids = new Set([
            ...plan.rooms.map((room) => room.id),
            ...plan.openings.map((opening) => opening.id),
            ...plan.furniture.map((item) => item.id),
          ]);
          const roomId = uniqueId(ids, clipboard.room.id);
          ids.add(roomId);
          const pasted = cloneRoomDeep(clipboard.room);
          pasted.id = roomId;
          translateRoom(pasted, plan.gridSize, plan.gridSize);
          const nextPlan: FloorPlan = {
            ...plan,
            rooms: [...plan.rooms, pasted],
            openings: [
              ...plan.openings,
              ...clipboard.openings.map((opening) => {
                const id = uniqueId(ids, opening.id);
                ids.add(id);
                return { ...opening, id, roomId };
              }),
            ],
            furniture: [
              ...plan.furniture,
              ...clipboard.furniture.map((item) => {
                const id = uniqueId(ids, item.id);
                ids.add(id);
                return { ...item, id, roomId };
              }),
            ],
          };
          set(
            commitPlan(get, nextPlan, {
              selectedRoomId: roomId,
              selectedFurnitureId: null,
              selectedOpeningId: null,
              placingOpeningKind: null,
            }),
          );
          return;
        }

        const furnitureRoom =
          selectedFurnitureId &&
          plan.furniture.find((item) => item.id === selectedFurnitureId)?.roomId;
        const targetRoomId =
          selectedRoomId ??
          furnitureRoom ??
          (clipboard.type === "furniture" ? clipboard.item.roomId : clipboard.opening.roomId);
        const room = plan.rooms.find((entry) => entry.id === targetRoomId);
        if (!room) return;

        if (clipboard.type === "furniture") {
          const source = clipboard.item;
          const placed = placeFurnitureInRoom(
            room,
            plan.furniture,
            source,
            plan.gridSize,
            { x: source.x + plan.gridSize, y: source.y + plan.gridSize },
          );
          const existing = new Set(plan.furniture.map((item) => item.id));
          const result = commandAddFurniture(brief, plan, {
            roomId: room.id,
            name: source.name,
            kind: source.kind,
            x: placed.x,
            y: placed.y,
            width: placed.width,
            height: placed.height,
          });
          const added = result.plan.furniture.find((item) => !existing.has(item.id));
          set(
            commitPlan(get, result.plan, {
              brief: result.brief,
              selectedRoomId: null,
              selectedOpeningId: null,
              selectedFurnitureId: added?.id ?? null,
              placingOpeningKind: null,
              showObjects: true,
            }),
          );
          return;
        }

        const source = clipboard.opening;
        const existing = new Set(plan.openings.map((opening) => opening.id));
        const result = commandAddOpening(brief, plan, {
          kind: source.kind,
          roomId: room.id,
          edge: source.edge,
          offset: source.offset + plan.gridSize,
          width: source.width,
        });
        const added = result.plan.openings.find((opening) => !existing.has(opening.id));
        set(
          commitPlan(get, result.plan, {
            brief: result.brief,
            selectedRoomId: null,
            selectedFurnitureId: null,
            selectedOpeningId: added?.id ?? null,
            placingOpeningKind: null,
            showDoors: source.kind === "door" ? true : get().showDoors,
          }),
        );
      },
      duplicateSelected: () => {
        get().copySelected();
        get().pasteClipboard();
      },
      beginHistoryGesture: () => {
        const state = get();
        if (state.historyGesture) return;
        resetHistoryClock();
        set({
          historyGesture: true,
          ...pushHistory(state.past, captureHistory(state), false),
        });
      },
      endHistoryGesture: () => {
        const state = get();
        if (!state.historyGesture) return;
        const last = state.past[state.past.length - 1];
        const unused = last && plansMatch(last.plan, state.plan);
        resetHistoryClock();
        set({
          historyGesture: false,
          past: unused ? state.past.slice(0, -1) : state.past,
        });
      },
      undo: () => {
        const state = get();
        if (state.past.length === 0) return;
        resetHistoryClock();
        const current = captureHistory(state);
        const previous = state.past[state.past.length - 1];
        set({
          ...restoreHistory(previous),
          past: state.past.slice(0, -1),
          future: [...state.future, current],
          historyGesture: false,
          placingOpeningKind: null,
        });
      },
      redo: () => {
        const state = get();
        if (state.future.length === 0) return;
        resetHistoryClock();
        const current = captureHistory(state);
        const next = state.future[state.future.length - 1];
        set({
          ...restoreHistory(next),
          future: state.future.slice(0, -1),
          past: [...state.past, current],
          historyGesture: false,
          placingOpeningKind: null,
        });
      },
      clearSelection: () =>
        set({
          selectedRoomId: null,
          selectedFurnitureId: null,
          selectedOpeningId: null,
          placingOpeningKind: null,
        }),
      setPendingQuestions: (questions, source = "chat") =>
        set({
          pendingQuestions: questions,
          questionSource: questions ? source : null,
        }),
      setChatReplyHandler: (handler) => set({ chatReplyHandler: handler }),
      waitForAnswers: (questions, signal) => {
        waiter?.reject(new Error("Replaced by a newer question set."));
        set({ pendingQuestions: questions, questionSource: "webmcp" });
        return new Promise<Record<string, string>>((resolve, reject) => {
          const onAbort = () => {
            waiter = null;
            set({ pendingQuestions: null, questionSource: null });
            reject(new DOMException("ask_user was cancelled.", "AbortError"));
          };
          if (signal?.aborted) {
            onAbort();
            return;
          }
          signal?.addEventListener("abort", onAbort, { once: true });
          waiter = {
            resolve: (answers) => {
              signal?.removeEventListener("abort", onAbort);
              waiter = null;
              resolve(answers);
            },
            reject: (error) => {
              signal?.removeEventListener("abort", onAbort);
              waiter = null;
              reject(error);
            },
          };
        });
      },
      submitAnswers: (answers) => {
        const brief = {
          ...get().brief,
          answers: { ...get().brief.answers, ...answers },
        };
        // Resolve any blocking waiter (legacy) and clear the form.
        set({ brief, pendingQuestions: null, questionSource: null });
        waiter?.resolve(answers);
        waiter = null;
      },
      setWebmcpStatus: (status) => set({ webmcpStatus: status }),
      importProject: (brief, plan) => {
        const nextPlan = normalizePlan(plan);
        set(
          commitPlan(get, nextPlan, {
            brief,
            selectedRoomId: null,
            selectedFurnitureId: null,
            selectedOpeningId: null,
            placingOpeningKind: null,
            clipboard: null,
            pendingQuestions: null,
            questionSource: null,
            future: [],
          }),
        );
      },
      reset: () => {
        waiter?.reject(new Error("Studio reset."));
        waiter = null;
        set({
          brief: emptyBrief(),
          plan: emptyPlan(),
          selectedRoomId: null,
          selectedFurnitureId: null,
          selectedOpeningId: null,
          pendingQuestions: null,
          questionSource: null,
          pendingExport: null,
          placingOpeningKind: null,
          measureMode: false,
          clipboard: null,
          past: [],
          future: [],
          historyGesture: false,
          view3dOpen: false,
          chatMessages: [],
          sessionKey: get().sessionKey + 1,
        });
      },
    }),
    {
      name: "webmcp-architect-studio",
      skipHydration: true,
      partialize: (state) => ({
        brief: state.brief,
        plan: state.plan,
        chatMessages: state.chatMessages,
        pendingQuestions:
          state.questionSource === "chat" ? state.pendingQuestions : null,
        questionSource: state.questionSource === "chat" ? "chat" : null,
        displayUnit: state.displayUnit,
        showRoomColors: state.showRoomColors,
        showDoors: state.showDoors,
        showObjects: state.showObjects,
        clipboard: cloneClipboard(state.clipboard),
        past: state.past,
        future: state.future,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<StudioState> | undefined;
        const chatSource = saved?.questionSource === "chat";
        const savedLayers = {
          roomColors: saved?.showRoomColors,
          doors: saved?.showDoors,
          objects: saved?.showObjects,
        };
        const layers = isDisplayLayers(savedLayers)
          ? {
              showRoomColors: savedLayers.roomColors,
              showDoors: savedLayers.doors,
              showObjects: savedLayers.objects,
            }
          : {
              showRoomColors: current.showRoomColors,
              showDoors: current.showDoors,
              showObjects: current.showObjects,
            };
        return {
          ...current,
          ...saved,
          brief: saved?.brief ?? current.brief,
          plan: saved?.plan ? normalizePlan(saved.plan) : current.plan,
          chatMessages: Array.isArray(saved?.chatMessages)
            ? saved.chatMessages
            : current.chatMessages,
          pendingQuestions: chatSource ? (saved?.pendingQuestions ?? null) : null,
          questionSource: chatSource ? "chat" : null,
          displayUnit: isDisplayUnit(saved?.displayUnit)
            ? saved.displayUnit
            : current.displayUnit,
          clipboard: cloneClipboard(saved?.clipboard ?? current.clipboard),
          past: normalizeHistoryList(saved?.past),
          future: normalizeHistoryList(saved?.future),
          historyGesture: false,
          ...layers,
        };
      },
    },
  ),
);
