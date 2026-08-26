"use client";

import { useState } from "react";
import { Box, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadPlanExport } from "@/lib/floor-plan/export-file";
import { sanitizeExportFilename } from "@/lib/floor-plan/export-name";
import type { ExportFormat } from "@/lib/floor-plan/types";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function ExportButtons() {
  const plan = useStudioStore((state) => state.plan);
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const showRoomColors = useStudioStore((state) => state.showRoomColors);
  const showDoors = useStudioStore((state) => state.showDoors);
  const showObjects = useStudioStore((state) => state.showObjects);
  const openView3d = useStudioStore((state) => state.openView3d);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = plan.rooms.length === 0 || busy !== null;

  async function exportAs(format: ExportFormat) {
    setError(null);
    setBusy(format);
    try {
      await downloadPlanExport(
        plan,
        format,
        sanitizeExportFilename("floor-plan", format),
        displayUnit,
        {
          roomColors: showRoomColors,
          doors: showDoors,
          objects: showObjects,
        },
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1">
      <div className="flex gap-1 rounded-xl border bg-background/95 p-1 shadow-sm">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={plan.rooms.length === 0}
          aria-label="Generate 3D view of the floor plan"
          title={plan.rooms.length === 0 ? "Draw a layout first" : "Generate 3D"}
          onClick={() => openView3d(sanitizeExportFilename("floor-plan", "glb"))}
        >
          <Box data-icon="inline-start" />
          3D
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled}
          aria-label="Download floor plan as PNG"
          title={plan.rooms.length === 0 ? "Draw a layout first" : "Download PNG"}
          onClick={() => void exportAs("png")}
        >
          <FileDown data-icon="inline-start" />
          {busy === "png" ? "PNG…" : "PNG"}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled}
          aria-label="Download floor plan as PDF"
          title={plan.rooms.length === 0 ? "Draw a layout first" : "Download PDF"}
          onClick={() => void exportAs("pdf")}
        >
          <FileDown data-icon="inline-start" />
          {busy === "pdf" ? "PDF…" : "PDF"}
        </Button>
      </div>
      {error ? <p className="max-w-48 text-right text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
