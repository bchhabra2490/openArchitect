"use client";

import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/lib/store/use-studio-store";
import { cn } from "@/lib/utils";

const LAYERS = [
  { key: "showRoomColors", label: "Colors", hint: "Room fill colors" },
  { key: "showDoors", label: "Doors", hint: "Doors on walls" },
  { key: "showObjects", label: "Objects", hint: "Furniture and fixtures" },
] as const;

export function LayerToggles({ className }: { className?: string }) {
  const showRoomColors = useStudioStore((state) => state.showRoomColors);
  const showDoors = useStudioStore((state) => state.showDoors);
  const showObjects = useStudioStore((state) => state.showObjects);
  const setShowRoomColors = useStudioStore((state) => state.setShowRoomColors);
  const setShowDoors = useStudioStore((state) => state.setShowDoors);
  const setShowObjects = useStudioStore((state) => state.setShowObjects);
  const on = {
    showRoomColors,
    showDoors,
    showObjects,
  };
  const setOn = {
    showRoomColors: setShowRoomColors,
    showDoors: setShowDoors,
    showObjects: setShowObjects,
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)} role="group" aria-label="Plan layers">
      <span className="text-[11px] text-muted-foreground">Show</span>
            <div className="flex rounded-lg border p-0.5">
        {LAYERS.map((layer) => (
          <Button
            key={layer.key}
            type="button"
            size="xs"
            variant={on[layer.key] ? "default" : "ghost"}
            aria-pressed={on[layer.key]}
            title={
              on[layer.key]
                ? `Hide ${layer.hint.toLowerCase()}`
                : `Show ${layer.hint.toLowerCase()}`
            }
            onClick={() => setOn[layer.key](!on[layer.key])}
          >
            {layer.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
