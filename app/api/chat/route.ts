import { createAgentUIStreamResponse } from "ai";
import { z } from "zod";
import {
  createArchitectAgent,
  type ArchitectUIMessage,
} from "@/lib/agents/architect-agent";
import { emptyBrief, emptyPlan, normalizePlan } from "@/lib/floor-plan/defaults";
import { briefSchema, floorPlanSchema } from "@/lib/floor-plan/schema";

const bodySchema = z.object({
  messages: z.array(z.unknown()),
  brief: z.unknown().optional(),
  plan: z.unknown().optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);
  const briefParsed = briefSchema.safeParse(body.brief);
  const planParsed = floorPlanSchema.safeParse(body.plan);

  const agent = createArchitectAgent({
    brief: briefParsed.success ? briefParsed.data : emptyBrief(),
    plan: planParsed.success
      ? normalizePlan({
          units: "m",
          gridSize: planParsed.data.gridSize,
          plot: planParsed.data.plot,
          street: planParsed.data.street ?? null,
          rooms: planParsed.data.rooms,
          openings: planParsed.data.openings,
          furniture: planParsed.data.furniture,
        })
      : emptyPlan(),
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages as ArchitectUIMessage[],
    abortSignal: request.signal,
  });
}
