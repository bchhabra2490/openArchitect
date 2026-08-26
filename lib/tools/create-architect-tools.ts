import { tool } from "ai";
import type { Brief, ClarifyingQuestion, DesignIndex, DesignVariant, FloorPlan } from "@/lib/floor-plan/types";
import {
  commandAddFurniture,
  commandAddOpening,
  commandAddRoom,
  commandApplyLayout,
  commandExportPlan,
  commandGenerate3d,
  commandGetBrief,
  commandGetFloorPlan,
  commandMoveFurniture,
  commandMoveOpening,
  commandRemoveFurniture,
  commandRemoveOpening,
  commandRemoveRoom,
  commandReplaceFurniture,
  commandReplaceOpening,
  commandResizeFurniture,
  commandResizeOpening,
  commandResizeWall,
  commandSetPlot,
  commandSwitchDesign,
  commandUpdateBrief,
  commandUpdateRoom,
} from "@/lib/floor-plan/commands";
import { summarizeDesigns, syncActiveDesign } from "@/lib/floor-plan/designs";
import { DESIGN_RULES_FOR_AGENTS, DESIGN_RULES_REFERENCE } from "@/lib/floor-plan/design-rules";
import { toolInputSchemas } from "@/lib/floor-plan/schema";
import { TOOL_DESCRIPTIONS } from "./catalog";

export type StudioContext = {
  brief: Brief;
  plan: FloorPlan;
  designs: DesignVariant[];
  activeDesign: DesignIndex;
};

function commit(
  ctx: StudioContext,
  result: ReturnType<typeof commandGetBrief>,
) {
  const activeDesign = result.activeDesign ?? ctx.activeDesign;
  ctx.brief = result.brief;
  ctx.plan = result.plan;
  ctx.activeDesign = activeDesign;
  ctx.designs = syncActiveDesign(ctx.designs, activeDesign, result.plan, {
    label: result.designLabel,
    concept: result.designConcept,
  });
  return {
    ...result,
    activeDesign,
    designSummaries: summarizeDesigns(ctx.designs),
  };
}

export function createArchitectTools(ctx: StudioContext) {
  return {
    get_brief: tool({
      description: TOOL_DESCRIPTIONS.get_brief,
      inputSchema: toolInputSchemas.get_brief,
      execute: async () => {
        const snapshot = commandGetBrief(ctx.brief, ctx.plan);
        const summaries = summarizeDesigns(ctx.designs);
        const filled = summaries.filter((item) => item.roomCount > 0).length;
        return {
          ...snapshot,
          activeDesign: ctx.activeDesign,
          designSummaries: summaries,
          summary: `${snapshot.summary} Viewing design ${ctx.activeDesign}. ${filled}/3 layouts filled.`,
        };
      },
    }),
    get_design_rules: tool({
      description: TOOL_DESCRIPTIONS.get_design_rules,
      inputSchema: toolInputSchemas.get_design_rules,
      execute: async () => {
        const snapshot = commandGetBrief(ctx.brief, ctx.plan);
        return {
          ...snapshot,
          rules: DESIGN_RULES_REFERENCE,
          handbook: DESIGN_RULES_FOR_AGENTS,
          summary: "NBC-aligned house-making standards for each room type.",
        };
      },
    }),
    update_brief: tool({
      description: TOOL_DESCRIPTIONS.update_brief,
      inputSchema: toolInputSchemas.update_brief,
      execute: async (input) =>
        commit(ctx, commandUpdateBrief(ctx.brief, ctx.plan, input)),
    }),
    ask_user: tool({
      description: TOOL_DESCRIPTIONS.ask_user,
      inputSchema: toolInputSchemas.ask_user,
      execute: async (input) => {
        const snapshot = commandGetBrief(ctx.brief, ctx.plan);
        return {
          ...snapshot,
          questions: input.questions as ClarifyingQuestion[],
          summary:
            "Questions shown to the user. Wait for their next message before drawing.",
        };
      },
    }),
    get_floor_plan: tool({
      description: TOOL_DESCRIPTIONS.get_floor_plan,
      inputSchema: toolInputSchemas.get_floor_plan,
      execute: async () => {
        const snapshot = commandGetFloorPlan(ctx.brief, ctx.plan);
        return {
          ...snapshot,
          activeDesign: ctx.activeDesign,
          designLabel: ctx.designs[ctx.activeDesign - 1]?.label,
          designConcept: ctx.designs[ctx.activeDesign - 1]?.concept,
          designSummaries: summarizeDesigns(ctx.designs),
          summary: `Design ${ctx.activeDesign}: ${snapshot.summary}`,
        };
      },
    }),
    set_plot: tool({
      description: TOOL_DESCRIPTIONS.set_plot,
      inputSchema: toolInputSchemas.set_plot,
      execute: async (input) =>
        commit(ctx, commandSetPlot(ctx.brief, ctx.plan, input)),
    }),
    apply_layout: tool({
      description: TOOL_DESCRIPTIONS.apply_layout,
      inputSchema: toolInputSchemas.apply_layout,
      execute: async (input) => commit(ctx, commandApplyLayout(ctx.brief, ctx.plan, input)),
    }),
    switch_design: tool({
      description: TOOL_DESCRIPTIONS.switch_design,
      inputSchema: toolInputSchemas.switch_design,
      execute: async ({ variant }) => {
        const snapshot = commandSwitchDesign(ctx.brief, ctx.designs, variant);
        ctx.plan = snapshot.plan;
        ctx.activeDesign = variant;
        return snapshot;
      },
    }),
    add_room: tool({
      description: TOOL_DESCRIPTIONS.add_room,
      inputSchema: toolInputSchemas.add_room,
      execute: async (input) =>
        commit(ctx, commandAddRoom(ctx.brief, ctx.plan, input)),
    }),
    update_room: tool({
      description: TOOL_DESCRIPTIONS.update_room,
      inputSchema: toolInputSchemas.update_room,
      execute: async (input) =>
        commit(ctx, commandUpdateRoom(ctx.brief, ctx.plan, input)),
    }),
    remove_room: tool({
      description: TOOL_DESCRIPTIONS.remove_room,
      inputSchema: toolInputSchemas.remove_room,
      execute: async ({ id }) =>
        commit(ctx, commandRemoveRoom(ctx.brief, ctx.plan, id)),
    }),
    add_opening: tool({
      description: TOOL_DESCRIPTIONS.add_opening,
      inputSchema: toolInputSchemas.add_opening,
      execute: async (input) =>
        commit(ctx, commandAddOpening(ctx.brief, ctx.plan, input)),
    }),
    remove_opening: tool({
      description: TOOL_DESCRIPTIONS.remove_opening,
      inputSchema: toolInputSchemas.remove_opening,
      execute: async ({ id }) =>
        commit(ctx, commandRemoveOpening(ctx.brief, ctx.plan, id)),
    }),
    add_furniture: tool({
      description: TOOL_DESCRIPTIONS.add_furniture,
      inputSchema: toolInputSchemas.add_furniture,
      execute: async (input) =>
        commit(ctx, commandAddFurniture(ctx.brief, ctx.plan, input)),
    }),
    remove_furniture: tool({
      description: TOOL_DESCRIPTIONS.remove_furniture,
      inputSchema: toolInputSchemas.remove_furniture,
      execute: async ({ id }) =>
        commit(ctx, commandRemoveFurniture(ctx.brief, ctx.plan, id)),
    }),
    resize_wall: tool({
      description: TOOL_DESCRIPTIONS.resize_wall,
      inputSchema: toolInputSchemas.resize_wall,
      execute: async (input) =>
        commit(ctx, commandResizeWall(ctx.brief, ctx.plan, input)),
    }),
    replace_furniture: tool({
      description: TOOL_DESCRIPTIONS.replace_furniture,
      inputSchema: toolInputSchemas.replace_furniture,
      execute: async (input) =>
        commit(ctx, commandReplaceFurniture(ctx.brief, ctx.plan, input)),
    }),
    move_furniture: tool({
      description: TOOL_DESCRIPTIONS.move_furniture,
      inputSchema: toolInputSchemas.move_furniture,
      execute: async (input) =>
        commit(ctx, commandMoveFurniture(ctx.brief, ctx.plan, input)),
    }),
    resize_furniture: tool({
      description: TOOL_DESCRIPTIONS.resize_furniture,
      inputSchema: toolInputSchemas.resize_furniture,
      execute: async (input) =>
        commit(ctx, commandResizeFurniture(ctx.brief, ctx.plan, input)),
    }),
    replace_opening: tool({
      description: TOOL_DESCRIPTIONS.replace_opening,
      inputSchema: toolInputSchemas.replace_opening,
      execute: async (input) =>
        commit(ctx, commandReplaceOpening(ctx.brief, ctx.plan, input)),
    }),
    move_opening: tool({
      description: TOOL_DESCRIPTIONS.move_opening,
      inputSchema: toolInputSchemas.move_opening,
      execute: async (input) =>
        commit(ctx, commandMoveOpening(ctx.brief, ctx.plan, input)),
    }),
    resize_opening: tool({
      description: TOOL_DESCRIPTIONS.resize_opening,
      inputSchema: toolInputSchemas.resize_opening,
      execute: async (input) =>
        commit(ctx, commandResizeOpening(ctx.brief, ctx.plan, input)),
    }),
    export_png: tool({
      description: TOOL_DESCRIPTIONS.export_png,
      inputSchema: toolInputSchemas.export_png,
      execute: async (input) =>
        commit(ctx, commandExportPlan(ctx.brief, ctx.plan, "png", input.filename)),
    }),
    export_pdf: tool({
      description: TOOL_DESCRIPTIONS.export_pdf,
      inputSchema: toolInputSchemas.export_pdf,
      execute: async (input) =>
        commit(ctx, commandExportPlan(ctx.brief, ctx.plan, "pdf", input.filename)),
    }),
    generate_3d: tool({
      description: TOOL_DESCRIPTIONS.generate_3d,
      inputSchema: toolInputSchemas.generate_3d,
      execute: async (input) =>
        commit(ctx, commandGenerate3d(ctx.brief, ctx.plan, input.filename)),
    }),
  };
}
