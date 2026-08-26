"use client";

import { useRef, useState } from "react";
import { Box, ChevronDown, File, FileDown, FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadPlanExport } from "@/lib/floor-plan/export-file";
import { sanitizeExportFilename } from "@/lib/floor-plan/export-name";
import {
  downloadProjectFile,
  readProjectFile,
  sanitizeProjectFilename,
} from "@/lib/floor-plan/project-file";
import type { ExportFormat } from "@/lib/floor-plan/types";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function ExportButtons() {
  const plan = useStudioStore((state) => state.plan);
  const brief = useStudioStore((state) => state.brief);
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const showRoomColors = useStudioStore((state) => state.showRoomColors);
  const showDoors = useStudioStore((state) => state.showDoors);
  const showObjects = useStudioStore((state) => state.showObjects);
  const openView3d = useStudioStore((state) => state.openView3d);
  const importProject = useStudioStore((state) => state.importProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<ExportFormat | "json" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportDisabled = plan.rooms.length === 0 || busy !== null;

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

  function exportProject() {
    setError(null);
    try {
      downloadProjectFile(brief, plan, sanitizeProjectFilename("openarchitect-project"));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Project export failed.");
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("import");
    try {
      const project = await readProjectFile(file);
      importProject(project.brief, project.plan);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Import failed.");
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import OpenArchitect project JSON"
        onChange={(event) => void onImportFile(event.target.files?.[0])}
      />
      <div className="flex flex-wrap justify-end gap-1 rounded-xl border bg-background/95 p-1 shadow-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={busy !== null}
              aria-label="File menu"
            >
              <FolderOpen data-icon="inline-start" />
              {busy === "import"
                ? "Import…"
                : busy === "png"
                  ? "PNG…"
                  : busy === "pdf"
                    ? "PDF…"
                    : "File"}
              <ChevronDown data-icon="inline-end" className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== null}
            >
              <FileUp />
              Import JSON…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportProject} disabled={busy !== null}>
              <File />
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void exportAs("png")}
              disabled={exportDisabled}
            >
              <FileDown />
              Export PNG
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void exportAs("pdf")}
              disabled={exportDisabled}
            >
              <FileDown />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      </div>
      {error ? <p className="max-w-56 text-right text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
