"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, FileDown, X } from "lucide-react";
import { DesignSwitcher } from "@/components/studio/design-switcher";
import { LayerToggles } from "@/components/studio/layer-toggles";
import { Button } from "@/components/ui/button";
import { sanitizeExportFilename } from "@/lib/floor-plan/export-name";
import type { DisplayLayers } from "@/lib/floor-plan/layers";
import type { FloorPlan } from "@/lib/floor-plan/types";
import type { FloorPlan3dHandle } from "@/lib/floor-plan/render-3d";
import { useStudioStore } from "@/lib/store/use-studio-store";

function FloorPlan3dCanvas({
  plan,
  layers,
  onHandle,
}: {
  plan: FloorPlan;
  layers: DisplayLayers;
  onHandle: (handle: FloorPlan3dHandle | null, error?: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let mounted: FloorPlan3dHandle | null = null;
    void import("@/lib/floor-plan/render-3d")
      .then(({ mountFloorPlan3d }) => {
        if (cancelled || !canvasRef.current) return null;
        return mountFloorPlan3d(canvasRef.current, plan, layers);
      })
      .then((handle) => {
        if (cancelled) {
          handle?.dispose();
          return;
        }
        mounted = handle ?? null;
        if (handle) onHandle(handle);
        else onHandle(null, "Could not build the 3D view.");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        onHandle(null, cause instanceof Error ? cause.message : "Could not build the 3D view.");
      });
    return () => {
      cancelled = true;
      mounted?.dispose();
    };
  }, [layers, onHandle, plan]);

  return (
    <div className="h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}

export function FloorPlan3dViewer() {
  const open = useStudioStore((state) => state.view3dOpen);
  if (!open) return null;
  return <FloorPlan3dSession />;
}

function FloorPlan3dSession() {
  const filename = useStudioStore((state) => state.view3dFilename);
  const plan = useStudioStore((state) => state.plan);
  const showRoomColors = useStudioStore((state) => state.showRoomColors);
  const showDoors = useStudioStore((state) => state.showDoors);
  const showObjects = useStudioStore((state) => state.showObjects);
  const closeView3d = useStudioStore((state) => state.closeView3d);
  const handleRef = useRef<FloorPlan3dHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeView3d();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeView3d]);

  const onHandle = useCallback((handle: FloorPlan3dHandle | null, nextError?: string) => {
    handleRef.current = handle;
    setReady(Boolean(handle));
    setError(nextError ?? null);
  }, []);

  async function download() {
    const handle = handleRef.current;
    if (!handle) return;
    setBusy(true);
    setError(null);
    try {
      await handle.downloadGlb(filename || sanitizeExportFilename("floor-plan", "glb"));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not download GLB.");
    } finally {
      setBusy(false);
    }
  }

  const empty = plan.rooms.length === 0;
  const layers = useMemo(
    () => ({ roomColors: showRoomColors, doors: showDoors, objects: showObjects }),
    [showDoors, showObjects, showRoomColors],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#cfd8e3]">
      <div className="flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2.5">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Box className="size-4" />
            3D house
          </p>
          <p className="text-xs text-muted-foreground">
            Drag to orbit · scroll to zoom · dollhouse view (no ceiling)
          </p>
        </div>
        <DesignSwitcher />
        <div className="flex items-center gap-1.5">
          <LayerToggles />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={empty || !ready || busy}
            onClick={() => void download()}
          >
            <FileDown data-icon="inline-start" />
            {busy ? "GLB…" : "Download GLB"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={closeView3d} aria-label="Close 3D view">
            <X data-icon="inline-start" />
            Close
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {empty ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Draw a layout first, then generate 3D.
          </p>
        ) : (
          <FloorPlan3dCanvas plan={plan} layers={layers} onHandle={onHandle} />
        )}
        {empty || ready ? null : (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Building 3D…
          </p>
        )}
        {error ? (
          <p className="absolute bottom-4 left-1/2 max-w-md -translate-x-1/2 rounded-xl bg-background/90 px-3 py-2 text-center text-xs text-destructive shadow-sm">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
