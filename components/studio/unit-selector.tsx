"use client";

import { Button } from "@/components/ui/button";
import { DISPLAY_UNITS } from "@/lib/floor-plan/units";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function UnitSelector() {
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const setDisplayUnit = useStudioStore((state) => state.setDisplayUnit);

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Dimension units"
    >
      <span className="hidden text-[11px] text-muted-foreground sm:inline">Units</span>
      <div className="flex rounded-lg border p-0.5">
        {DISPLAY_UNITS.map((unit) => (
          <Button
            key={unit}
            type="button"
            size="xs"
            variant={displayUnit === unit ? "default" : "ghost"}
            aria-pressed={displayUnit === unit}
            onClick={() => setDisplayUnit(unit)}
          >
            {unit}
          </Button>
        ))}
      </div>
    </div>
  );
}
