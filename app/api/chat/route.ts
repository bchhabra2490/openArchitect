import { createAgentUIStreamResponse } from "ai";
import { z } from "zod";
import {
  createArchitectAgent,
  type ArchitectUIMessage,
} from "@/lib/agents/architect-agent";
import { emptyBrief, emptyPlan, normalizePlan } from "@/lib/floor-plan/defaults";
import { emptyDesigns, isDesignIndex } from "@/lib/floor-plan/designs";
import { briefSchema, floorPlanSchema } from "@/lib/floor-plan/schema";
import type { FloorPlan } from "@/lib/floor-plan/types";
import { DESIGN_INDEXES } from "@/lib/floor-plan/types";

const designSlotSchema = z.object({
  label: z.string().optional(),
  concept: z.string().optional(),
  plan: z.unknown().optional(),
});

const bodySchema = z.object({
  messages: z.array(z.unknown()),
  brief: z.unknown().optional(),
  plan: z.unknown().optional(),
  designs: z.array(designSlotSchema).optional(),
  activeDesign: z.unknown().optional(),
});

function parseFloorPlan(value: unknown): FloorPlan {
  const parsed = floorPlanSchema.safeParse(value);
  if (!parsed.success) return emptyPlan();
  return normalizePlan({
    units: "m",
    gridSize: parsed.data.gridSize,
    plot: parsed.data.plot,
    street: parsed.data.street ?? null,
    rooms: parsed.data.rooms,
    openings: parsed.data.openings,
    furniture: parsed.data.furniture,
  });
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);
  const briefParsed = briefSchema.safeParse(body.brief);
  const plan = parseFloorPlan(body.plan);
  const activeDesign = isDesignIndex(body.activeDesign) ? body.activeDesign : 1;
  const designs = emptyDesigns();
  body.designs?.slice(0, 3).forEach((slot, i) => {
    const index = DESIGN_INDEXES[i];
    if (!index || !slot) return;
    designs[i] = {
      index,
      label: slot.label?.trim() || `Design ${index}`,
      concept: slot.concept ?? "",
      plan: parseFloorPlan(slot.plan),
    };
  });
  if (!body.designs?.length) {
    designs[0] = { ...designs[0], plan };
  }
  designs[activeDesign - 1] = { ...designs[activeDesign - 1], plan };

  const agent = createArchitectAgent({
    brief: briefParsed.success ? briefParsed.data : emptyBrief(),
    plan,
    designs,
    activeDesign,
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages as ArchitectUIMessage[],
    abortSignal: request.signal,
  });
}
