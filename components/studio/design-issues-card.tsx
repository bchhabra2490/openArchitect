"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "@/components/studio/sidebar-section";
import type { ValidationIssue } from "@/lib/floor-plan/types";
import { validatePlan } from "@/lib/floor-plan/validate";
import { useStudioStore } from "@/lib/store/use-studio-store";

export function DesignIssuesCard({
  chatEnabled = false,
  busy = false,
  onFix,
}: {
  chatEnabled?: boolean;
  busy?: boolean;
  onFix?: (issues: ValidationIssue[]) => void;
}) {
  const plan = useStudioStore((state) => state.plan);
  const brief = useStudioStore((state) => state.brief);
  const issues = validatePlan(plan, brief).filter((issue) => issue.code !== "empty_plan");

  if (issues.length === 0) return null;

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const canFix = Boolean(onFix) && chatEnabled && !busy;

  return (
    <SidebarSection
      title="Standards check"
      badge={
        <Badge variant={errors ? "destructive" : "secondary"}>{issues.length}</Badge>
      }
      action={
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!canFix}
          title={
            !chatEnabled
              ? "In-app chat needs an OpenAI API key to auto-fix"
              : busy
                ? "Agent is already working"
                : "Ask the agent to fix these issues"
          }
          onClick={() => onFix?.(issues)}
        >
          Fix
        </Button>
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
