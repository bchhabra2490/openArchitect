"use client";

import { DESIGN_INDEXES } from "@/lib/floor-plan/types";
import { useStudioStore } from "@/lib/store/use-studio-store";
import { cn } from "@/lib/utils";

export function DesignSwitcher() {
  const designs = useStudioStore((state) => state.designs);
  const activeDesign = useStudioStore((state) => state.activeDesign);
  const selectDesign = useStudioStore((state) => state.selectDesign);
  const active = designs.find((design) => design.index === activeDesign);

  return (
    <div className="pointer-events-auto flex max-w-[min(100%,22rem)] flex-col items-center gap-1">
      <div
        role="tablist"
        aria-label="Design alternatives"
        className="flex gap-0.5 rounded-xl border bg-background/95 p-1 shadow-sm"
      >
        {DESIGN_INDEXES.map((index) => {
          const slot = designs.find((design) => design.index === index);
          const filled = (slot?.plan.rooms.length ?? 0) > 0;
          const selected = index === activeDesign;
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={
                filled
                  ? `${slot?.label ?? `Design ${index}`}`
                  : `Design ${index}, empty`
              }
              className={cn(
                "min-w-9 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : filled
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => selectDesign(index)}
            >
              {index}
            </button>
          );
        })}
      </div>
      <p className="max-w-full truncate px-1 text-center text-[11px] text-muted-foreground">
        {active?.concept
          ? `${active.label} — ${active.concept}`
          : (active?.label ?? "Design 1")}
      </p>
    </div>
  );
}
