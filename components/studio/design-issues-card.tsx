"use client";

import { Badge } from "@/components/ui/badge";
import { SidebarSection } from "@/components/studio/sidebar-section";
import { validatePlan } from "@/lib/floor-plan/validate";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function DesignIssuesCard() {
  const plan = useStudioStore((state) => state.plan);
  const issues = validatePlan(plan).filter((issue) => issue.code !== "empty_plan");

  if (issues.length === 0) return null;

  const errors = issues.filter((issue) => issue.severity === "error").length;

  return (
    <SidebarSection
      title="Standards check"
      badge={
        <Badge variant={errors ? "destructive" : "secondary"}>{issues.length}</Badge>
      }
    >
      <ul className="flex flex-col gap-1 text-[11px] leading-relaxed">
        {issues.slice(0, 8).map((issue, index) => (
          <li
            key={`${issue.code}-${issue.entityId ?? index}`}
            className={
              issue.severity === "error" ? "text-destructive" : "text-muted-foreground"
            }
          >
            {issue.message}
          </li>
        ))}
      </ul>
    </SidebarSection>
  );
}
