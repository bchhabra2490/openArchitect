import { emptyPlan, normalizePlan } from "./defaults";
import {
  DESIGN_INDEXES,
  type DesignIndex,
  type DesignSummary,
  type DesignVariant,
  type FloorPlan,
} from "./types";

export function isDesignIndex(value: unknown): value is DesignIndex {
  return value === 1 || value === 2 || value === 3;
}

export function emptyDesign(index: DesignIndex): DesignVariant {
  return {
    index,
    label: `Design ${index}`,
    concept: "",
    plan: emptyPlan(),
  };
}

export function emptyDesigns(): DesignVariant[] {
  return DESIGN_INDEXES.map((index) => emptyDesign(index));
}

export function summarizeDesigns(designs: DesignVariant[]): DesignSummary[] {
  return designs.map((design) => ({
    index: design.index,
    label: design.label,
    concept: design.concept,
    roomCount: design.plan.rooms.length,
  }));
}

export function syncActiveDesign(
  designs: DesignVariant[],
  activeDesign: DesignIndex,
  plan: FloorPlan,
  meta?: { label?: string; concept?: string },
): DesignVariant[] {
  return designs.map((design) => {
    if (design.index !== activeDesign) return design;
    const label = meta?.label?.trim();
    return {
      ...design,
      plan,
      label: label || design.label,
      concept: meta?.concept ?? design.concept,
    };
  });
}

export function normalizeDesigns(
  designs: DesignVariant[] | undefined,
  fallbackPlan: FloorPlan,
): DesignVariant[] {
  const slots = emptyDesigns();
  if (!Array.isArray(designs) || designs.length === 0) {
    slots[0] = { ...slots[0], plan: normalizePlan(fallbackPlan) };
    return slots;
  }
  return slots.map((slot, i) => {
    const saved = designs[i];
    if (!saved) return slot;
    return {
      index: slot.index,
      label:
        typeof saved.label === "string" && saved.label.trim()
          ? saved.label.trim()
          : slot.label,
      concept: typeof saved.concept === "string" ? saved.concept : "",
      plan: saved.plan ? normalizePlan(saved.plan) : emptyPlan(),
    };
  });
}
