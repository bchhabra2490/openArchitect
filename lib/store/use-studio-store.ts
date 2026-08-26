import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UIMessage } from "ai";
import { commandAddFurniture, commandAddOpening, commandRemoveFurniture, commandRemoveOpening } from "@/lib/floor-plan/commands";
import { emptyBrief, emptyPlan, nearestBlockSize, normalizePlan } from "@/lib/floor-plan/defaults";
import {
  emptyDesigns,
  isDesignIndex,
  normalizeDesigns,
  syncActiveDesign,
} from "@/lib/floor-plan/designs";
import {
  defaultOpeningWidth,
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
  DesignIndex,
  DesignVariant,
  Edge,
  FloorPlan,
  OpeningKind,
  PlanExport,
  StudioClipboard,
} from "@/lib/floor-plan/types";
import { isDisplayLayers } from "@/lib/floor-plan/layers";
import { isDisplayUnit, type DisplayUnit } from "@/lib/floor-plan/units";

export type WebMcpStatus = "unknown" | "available" | "unavailable";
export type QuestionSource = "chat" | "webmcp" | null;

type StudioState = {
  brief: Brief;
  plan: FloorPlan;
  designs: DesignVariant[];
  activeDesign: DesignIndex;
  selectedRoomId: string | null;
  selectedFurnitureId: string | null;
  selectedOpeningId: string | null;
  placingOpeningKind: OpeningKind | null;
  clipboard: StudioClipboard | null;
  pendingQuestions: ClarifyingQuestion[] | null;
  questionSource: QuestionSource;
  webmcpStatus: WebMcpStatus;
  pendingExport: (PlanExport & { id: number }) | null;
  chatMessages: UIMessage[];
  displayUnit: DisplayUnit;
  showRoomColors: boolean;
  showDoors: boolean;
  showObjects: boolean;
  applyResult: (result: Pick<
    CommandResult,
    | "brief"
    | "plan"
    | "exportFile"
    | "view3d"
    | "activeDesign"
    | "designLabel"
    | "designConcept"
  >) => void;
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
  addFurnitureInRoom: (roomId: string, kind: string) => void;
  replaceSelectedFurniture: (kind: string) => void;
  moveSelectedFurniture: (x: number, y: number) => void;
  resizeSelectedFurniture: (width: number, height: number) => void;
  renameSelectedFurniture: (name: string) => void;
  removeSelectedFurniture: () => void;
  replaceSelectedOpening: (kind: OpeningKind) => void;
  setPlacingOpeningKind: (kind: OpeningKind | null) => void;
  addOpeningOnWall: (roomId: string, edge: Edge, kind: OpeningKind, along: number) => void;
  moveSelectedOpening: (offset: number, edge?: Edge) => void;
  resizeSelectedOpening: (width: number, offset?: number) => void;
  removeSelectedOpening: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  clearSelection: () => void;
  setPendingQuestions: (questions: ClarifyingQuestion[] | null) => void;
  waitForAnswers: (
    questions: ClarifyingQuestion[],
    signal?: AbortSignal,
  ) => Promise<Record<string, string>>;
  submitAnswers: (answers: Record<string, string>) => void;
  setWebmcpStatus: (status: WebMcpStatus) => void;
  reset: () => void;
  selectDesign: (index: DesignIndex) => void;
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
  meta?: { label?: string; concept?: string; activeDesign?: DesignIndex },
): Partial<StudioState> {
  const activeDesign = meta?.activeDesign ?? extra.activeDesign ?? get().activeDesign;
  return {
    ...extra,
    plan,
    activeDesign,
    designs: syncActiveDesign(get().designs, activeDesign, plan, {
      label: meta?.label,
      concept: meta?.concept,
    }),
  };
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      brief: emptyBrief(),
      plan: emptyPlan(),
      designs: emptyDesigns(),
      activeDesign: 1,
      selectedRoomId: null,
      selectedFurnitureId: null,
      selectedOpeningId: null,
      placingOpeningKind: null,
      clipboard: null,
      pendingQuestions: null,
      questionSource: null,
      webmcpStatus: "unknown",
      pendingExport: null,
      view3dOpen: false,
      view3dFilename: "floor-plan.glb",
      chatMessages: [],
      displayUnit: "m",
      showRoomColors: true,
      showDoors: true,
      showObjects: true,
      applyResult: (result) => {
        const { selectedRoomId, selectedFurnitureId, selectedOpeningId } = get();
        const plan = normalizePlan(result.plan);
        const activeDesign = isDesignIndex(result.activeDesign)
          ? result.activeDesign
          : get().activeDesign;
        set(
          commitPlan(
            get,
            plan,
            {
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
            },
            {
              activeDesign,
              label: result.designLabel,
              concept: result.designConcept,
            },
          ),
        );
      },
      selectDesign: (index) => {
        const { designs, activeDesign, plan } = get();
        if (index === activeDesign) return;
        const saved = syncActiveDesign(designs, activeDesign, plan);
        const next = saved.find((design) => design.index === index) ?? saved[0];
        set({
          designs: saved,
          activeDesign: index,
          plan: next.plan,
          selectedRoomId: null,
          selectedFurnitureId: null,
          selectedOpeningId: null,
          placingOpeningKind: null,
        });
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
        const { plan, designs } = get();
        set({
          plan: { ...plan, gridSize },
          designs: designs.map((design) => ({
            ...design,
            plan: { ...design.plan, gridSize },
          })),
        });
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
        set(commitPlan(get, renameRoom(get().plan, id, name)));
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
        set(commitPlan(get, renameFurniture(get().plan, id, name)));
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
          selectedFurnitureId: null,
          selectedOpeningId: null,
          showDoors: kind === "door" ? true : get().showDoors,
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
        const { plan, selectedFurnitureId, selectedOpeningId } = get();
        if (selectedFurnitureId) {
          const item = plan.furniture.find((entry) => entry.id === selectedFurnitureId);
          if (item) set({ clipboard: { type: "furniture", item: { ...item } } });
          return;
        }
        if (selectedOpeningId) {
          const opening = plan.openings.find((entry) => entry.id === selectedOpeningId);
          if (opening) set({ clipboard: { type: "opening", opening: { ...opening } } });
        }
      },
      pasteClipboard: () => {
        const { brief, plan, clipboard, selectedRoomId, selectedFurnitureId } = get();
        if (!clipboard) return;
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
      clearSelection: () =>
        set({
          selectedRoomId: null,
          selectedFurnitureId: null,
          selectedOpeningId: null,
          placingOpeningKind: null,
        }),
      setPendingQuestions: (questions) =>
        set({
          pendingQuestions: questions,
          questionSource: questions ? "chat" : null,
        }),
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
        set({ brief, pendingQuestions: null, questionSource: null });
        waiter?.resolve(answers);
        waiter = null;
      },
      setWebmcpStatus: (status) => set({ webmcpStatus: status }),
      reset: () => {
        waiter?.reject(new Error("Studio reset."));
        waiter = null;
        set({
          brief: emptyBrief(),
          plan: emptyPlan(),
          designs: emptyDesigns(),
          activeDesign: 1,
          selectedRoomId: null,
          selectedFurnitureId: null,
          selectedOpeningId: null,
          pendingQuestions: null,
          questionSource: null,
          pendingExport: null,
          placingOpeningKind: null,
          clipboard: null,
          view3dOpen: false,
          chatMessages: [],
        });
      },
    }),
    {
      name: "webmcp-architect-studio",
      skipHydration: true,
      partialize: (state) => ({
        brief: state.brief,
        plan: state.plan,
        designs: state.designs,
        activeDesign: state.activeDesign,
        chatMessages: state.chatMessages,
        pendingQuestions:
          state.questionSource === "chat" ? state.pendingQuestions : null,
        questionSource: state.questionSource === "chat" ? "chat" : null,
        displayUnit: state.displayUnit,
        showRoomColors: state.showRoomColors,
        showDoors: state.showDoors,
        showObjects: state.showObjects,
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
        const restored = normalizeDesigns(
          saved?.designs,
          saved?.plan ?? current.plan,
        );
        const activeDesign = isDesignIndex(saved?.activeDesign)
          ? saved.activeDesign
          : 1;
        if (saved?.plan) {
          restored[activeDesign - 1] = {
            ...restored[activeDesign - 1],
            plan: normalizePlan(saved.plan),
          };
        }
        return {
          ...current,
          ...saved,
          brief: saved?.brief ?? current.brief,
          designs: restored,
          activeDesign,
          plan: restored[activeDesign - 1]?.plan ?? current.plan,
          chatMessages: Array.isArray(saved?.chatMessages)
            ? saved.chatMessages
            : current.chatMessages,
          pendingQuestions: chatSource ? (saved?.pendingQuestions ?? null) : null,
          questionSource: chatSource ? "chat" : null,
          displayUnit: isDisplayUnit(saved?.displayUnit)
            ? saved.displayUnit
            : current.displayUnit,
          ...layers,
        };
      },
    },
  ),
);
