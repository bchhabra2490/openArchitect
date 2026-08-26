"use client";

import { useEffect, useRef } from "react";
import { downloadPlanExport } from "@/lib/floor-plan/export-file";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function useExportDownload() {
  const pendingExport = useStudioStore((state) => state.pendingExport);
  const plan = useStudioStore((state) => state.plan);
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const clearPendingExport = useStudioStore((state) => state.clearPendingExport);
  const handled = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingExport || handled.current === pendingExport.id) return;
    handled.current = pendingExport.id;
    const { format, filename } = pendingExport;
    const { showRoomColors, showDoors, showObjects } = useStudioStore.getState();
    void downloadPlanExport(plan, format, filename, displayUnit, {
      roomColors: showRoomColors,
      doors: showDoors,
      objects: showObjects,
    })
      .catch((error: unknown) => {
        console.error("Floor plan export failed", error);
      })
      .finally(() => {
        clearPendingExport();
      });
  }, [clearPendingExport, displayUnit, pendingExport, plan]);
}
