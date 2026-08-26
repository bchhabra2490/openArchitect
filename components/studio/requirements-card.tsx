"use client";

import { Badge } from "@/components/ui/badge";
import { SidebarSection } from "@/components/studio/sidebar-section";
import { formatSize } from "@/lib/floor-plan/units";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function RequirementsCard() {
  const brief = useStudioStore((state) => state.brief);
  const plan = useStudioStore((state) => state.plan);
  const activeDesign = useStudioStore((state) => state.activeDesign);
  const designs = useStudioStore((state) => state.designs);
  const displayUnit = useStudioStore((state) => state.displayUnit);
  const roomCount = plan.rooms.length;
  const answers = Object.entries(brief.answers);
  const active = designs.find((design) => design.index === activeDesign);
  const filled = designs.filter((design) => design.plan.rooms.length > 0).length;

  return (
    <SidebarSection title="Brief">
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <p className="text-foreground">
          {brief.description || "No requirements yet."}
        </p>
        <div className="flex flex-wrap gap-1">
          {brief.plotWidthM && brief.plotHeightM ? (
            <Badge variant="secondary">
              {formatSize(brief.plotWidthM, brief.plotHeightM, displayUnit)}
            </Badge>
          ) : (
            <Badge variant="outline">Plot unknown</Badge>
          )}
          {brief.bedroomCount != null ? (
            <Badge variant="secondary">{brief.bedroomCount} bed</Badge>
          ) : (
            <Badge variant="outline">Beds unknown</Badge>
          )}
          {brief.bathroomCount != null ? (
            <Badge variant="secondary">{brief.bathroomCount} bath</Badge>
          ) : null}
          <Badge variant="outline">{roomCount} rooms</Badge>
          <Badge variant="secondary">
            Design {activeDesign} of 3
            {filled ? ` · ${filled} drawn` : ""}
          </Badge>
        </div>
        {active?.concept ? <p>{active.concept}</p> : null}
        {answers.length > 0 ? (
          <ul className="space-y-0.5">
            {answers.map(([key, value]) => (
              <li key={key}>
                <span className="font-medium text-foreground">{key}:</span> {value}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SidebarSection>
  );
}
