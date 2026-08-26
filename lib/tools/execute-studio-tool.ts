import type { z } from "zod";
import {
  commandAddFurniture,
  commandAddOpening,
  commandAddRoom,
  commandApplyLayout,
  commandExportPlan,
  commandGenerate3d,
  commandGetBrief,
  commandGetFloorPlan,
  commandGetStandardsCheck,
  commandImportProject,
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
  commandUpdateBrief,
  commandUpdateRoom,
} from "@/lib/floor-plan/commands";
import { DESIGN_RULES_FOR_AGENTS, DESIGN_RULES_REFERENCE } from "@/lib/floor-plan/design-rules";
import { emptyBrief } from "@/lib/floor-plan/defaults";
import { parseProjectFile } from "@/lib/floor-plan/project-file";
import { toolInputSchemas, type ToolName } from "@/lib/floor-plan/schema";
import type { CommandResult } from "@/lib/floor-plan/types";
import { useStudioStore } from "@/lib/store/use-studio-store";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  return schema.parse(input ?? {});
}

export async function executeStudioTool(
  name: ToolName,
  rawInput: unknown,
): Promise<CommandResult> {
  const state = useStudioStore.getState();
  let result: CommandResult;

  switch (name) {
    case "get_brief":
      parse(toolInputSchemas.get_brief, rawInput);
      result = commandGetBrief(state.brief, state.plan);
      break;
    case "get_design_rules":
      parse(toolInputSchemas.get_design_rules, rawInput);
      result = {
        ...commandGetBrief(state.brief, state.plan),
        summary: "NBC-aligned house-making standards for each room type.",
        rules: DESIGN_RULES_REFERENCE,
        handbook: DESIGN_RULES_FOR_AGENTS,
      } as CommandResult;
      break;
    case "update_brief":
      result = commandUpdateBrief(
        state.brief,
        state.plan,
        parse(toolInputSchemas.update_brief, rawInput),
      );
      break;
    case "ask_user": {
      const input = parse(toolInputSchemas.ask_user, rawInput);
      // WebMCP: return questions to ChatGPT immediately (do not block).
      // Also surface the same form on the page so the human can answer either place.
      useStudioStore.getState().setPendingQuestions(input.questions, "webmcp");
      const lines = input.questions.map(
        (question) =>
          `- (${question.id}) ${question.prompt}` +
          (question.type === "choice" && question.options?.length
            ? ` [${question.options.join(" | ")}]`
            : question.type === "number"
              ? " [number]"
              : ""),
      );
      result = {
        ...commandGetBrief(state.brief, state.plan),
        questions: input.questions,
        summary: [
          "Ask the human these questions in your next message (they are also shown on the OpenArchitect page):",
          ...lines,
          "When they answer, call update_brief with { answers: { \"<question-id>\": \"<value>\", ... } }. If they answered on the page instead, call get_brief and continue. Do not apply_layout until answers are stored.",
        ].join("\n"),
      };
      break;
    }
    case "get_floor_plan":
      parse(toolInputSchemas.get_floor_plan, rawInput);
      result = commandGetFloorPlan(state.brief, state.plan);
      break;
    case "get_standards_check":
      parse(toolInputSchemas.get_standards_check, rawInput);
      result = commandGetStandardsCheck(state.brief, state.plan);
      break;
    case "set_plot":
      result = commandSetPlot(
        state.brief,
        state.plan,
        parse(toolInputSchemas.set_plot, rawInput),
      );
      break;
    case "apply_layout":
      result = commandApplyLayout(
        state.brief,
        state.plan,
        parse(toolInputSchemas.apply_layout, rawInput),
      );
      break;
    case "add_room":
      result = commandAddRoom(
        state.brief,
        state.plan,
        parse(toolInputSchemas.add_room, rawInput),
      );
      break;
    case "update_room":
      result = commandUpdateRoom(
        state.brief,
        state.plan,
        parse(toolInputSchemas.update_room, rawInput),
      );
      break;
    case "remove_room":
      result = commandRemoveRoom(
        state.brief,
        state.plan,
        parse(toolInputSchemas.remove_room, rawInput).id,
      );
      break;
    case "add_opening":
      result = commandAddOpening(
        state.brief,
        state.plan,
        parse(toolInputSchemas.add_opening, rawInput),
      );
      break;
    case "remove_opening":
      result = commandRemoveOpening(
        state.brief,
        state.plan,
        parse(toolInputSchemas.remove_opening, rawInput).id,
      );
      break;
    case "add_furniture":
      result = commandAddFurniture(
        state.brief,
        state.plan,
        parse(toolInputSchemas.add_furniture, rawInput),
      );
      break;
    case "remove_furniture":
      result = commandRemoveFurniture(
        state.brief,
        state.plan,
        parse(toolInputSchemas.remove_furniture, rawInput).id,
      );
      break;
    case "resize_wall":
      result = commandResizeWall(
        state.brief,
        state.plan,
        parse(toolInputSchemas.resize_wall, rawInput),
      );
      break;
    case "replace_furniture":
      result = commandReplaceFurniture(
        state.brief,
        state.plan,
        parse(toolInputSchemas.replace_furniture, rawInput),
      );
      break;
    case "move_furniture":
      result = commandMoveFurniture(
        state.brief,
        state.plan,
        parse(toolInputSchemas.move_furniture, rawInput),
      );
      break;
    case "resize_furniture":
      result = commandResizeFurniture(
        state.brief,
        state.plan,
        parse(toolInputSchemas.resize_furniture, rawInput),
      );
      break;
    case "replace_opening":
      result = commandReplaceOpening(
        state.brief,
        state.plan,
        parse(toolInputSchemas.replace_opening, rawInput),
      );
      break;
    case "move_opening":
      result = commandMoveOpening(
        state.brief,
        state.plan,
        parse(toolInputSchemas.move_opening, rawInput),
      );
      break;
    case "resize_opening":
      result = commandResizeOpening(
        state.brief,
        state.plan,
        parse(toolInputSchemas.resize_opening, rawInput),
      );
      break;
    case "export_png":
      result = commandExportPlan(
        state.brief,
        state.plan,
        "png",
        parse(toolInputSchemas.export_png, rawInput).filename,
      );
      break;
    case "export_pdf":
      result = commandExportPlan(
        state.brief,
        state.plan,
        "pdf",
        parse(toolInputSchemas.export_pdf, rawInput).filename,
      );
      break;
    case "export_project":
      result = commandExportPlan(
        state.brief,
        state.plan,
        "json",
        parse(toolInputSchemas.export_project, rawInput).filename,
      );
      break;
    case "import_project": {
      const input = parse(toolInputSchemas.import_project, rawInput);
      const parsed = parseProjectFile({
        version: input.version ?? 1,
        kind: input.kind ?? "openarchitect",
        brief: input.brief ?? emptyBrief(),
        plan: input.plan,
      });
      result = commandImportProject(state.brief, state.plan, parsed);
      break;
    }
    case "generate_3d":
      result = commandGenerate3d(
        state.brief,
        state.plan,
        parse(toolInputSchemas.generate_3d, rawInput).filename,
      );
      break;
    default: {
      const _never: never = name;
      throw new Error(`Unknown tool ${_never}`);
    }
  }

  useStudioStore.getState().applyResult(result);
  return result;
}
