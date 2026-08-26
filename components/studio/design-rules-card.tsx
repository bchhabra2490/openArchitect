"use client";

import { SidebarSection } from "@/components/studio/sidebar-section";
import { DESIGN_RULES_REFERENCE } from "@/lib/floor-plan/design-rules";

export function DesignRulesCard() {
  return (
    <SidebarSection title="House-making standards" defaultOpen={false}>
      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto text-[11px] leading-relaxed text-muted-foreground">
        <p>
          NBC 2016 room sizes, doors, and light/ventilation, plus common
          adjacency and NKBA kitchen layout. Local bye-laws can be stricter.
        </p>
        {DESIGN_RULES_REFERENCE.map((section) => (
          <div key={section.section}>
            <p className="font-medium text-foreground">{section.section}</p>
            <ul className="list-disc pl-4">
              {section.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SidebarSection>
  );
}
