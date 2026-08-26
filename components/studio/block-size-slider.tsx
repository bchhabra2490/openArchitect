"use client";

import { Slider } from "@/components/ui/slider";
import { BLOCK_SIZES_M, nearestBlockSize } from "@/lib/floor-plan/defaults";
import { formatLength } from "@/lib/floor-plan/units";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function BlockSizeSlider() {
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const gridSize = useStudioStore((state) => state.plan.gridSize);
  const setGridSize = useStudioStore((state) => state.setGridSize);
  const block = nearestBlockSize(gridSize);
  const index = Math.max(0, BLOCK_SIZES_M.indexOf(block));

  return (
    <div className="pointer-events-auto w-52 rounded-xl border bg-background/95 p-2.5 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium">Block size</p>
        <p className="text-[11px] text-muted-foreground">{formatLength(block, displayUnit)}</p>
      </div>
      <Slider
        min={0}
        max={BLOCK_SIZES_M.length - 1}
        step={1}
        value={[index]}
        onValueChange={(value) => {
          const next = BLOCK_SIZES_M[value[0] ?? index];
          if (next != null) setGridSize(next);
        }}
        aria-label="Grid block size"
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        1 square = {formatLength(block, displayUnit)}
      </p>
    </div>
  );
}
