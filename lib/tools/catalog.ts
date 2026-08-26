import type { ToolName } from "@/lib/floor-plan/schema";
import { toolInputSchemas } from "@/lib/floor-plan/schema";

export const TOOL_TITLES: Record<ToolName, string> = {
  get_brief: "Get brief",
  get_design_rules: "Get design rules",
  update_brief: "Update brief",
  ask_user: "Ask the user",
  get_floor_plan: "Get floor plan",
  set_plot: "Set plot size",
  apply_layout: "Apply full layout",
  switch_design: "Switch design",
  add_room: "Add room",
  update_room: "Update room",
  remove_room: "Remove room",
  add_opening: "Add door or window",
  remove_opening: "Remove opening",
  add_furniture: "Add furniture",
  remove_furniture: "Remove furniture",
  resize_wall: "Move a wall",
  replace_furniture: "Replace furniture",
  move_furniture: "Move furniture",
  resize_furniture: "Resize furniture",
  replace_opening: "Replace door or window",
  move_opening: "Move door or window",
  resize_opening: "Resize door or window",
  export_png: "Export PNG",
  export_pdf: "Export PDF",
  generate_3d: "Generate 3D",
};

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  get_brief:
    "Read the current project brief: description, plot size, bedroom/bathroom counts, notes, answers already collected, which of the three designs is visible, and how many layouts are filled.",
  get_design_rules:
    "Return the house-making standards this studio enforces: NBC-aligned room sizes, doors, windows, and adjacency rules for living, dining, bedrooms, kitchen, bathrooms, and hallways.",
  update_brief:
    "Patch the project brief. Use this to store requirements from the conversation. If plotWidthM and plotHeightM are set, the canvas plot is resized to match.",
  ask_user:
    "Ask the human one to six structured follow-up questions before drawing. Use when plot size or bedroom count is missing, or when a constraint is ambiguous. Do not call apply_layout until answers are in the brief.",
  get_floor_plan:
    "Return the visible design's floor plan JSON plus validation issues (overlaps, NBC size minima, missing exterior windows, awkward adjacencies). Also lists the other two design slots.",
  set_plot:
    "Set the overall rectangular plot size in meters. Origin is the top-left (northwest) corner. x increases east, y increases south.",
  apply_layout:
    "Replace rooms, openings, furniture, and the frontage street for one of three design slots. When drafting a new home, call this three times with variant 1, 2, and 3 — each a genuinely different layout of the same brief (same plot and room counts). Include label and concept. Include an entrance porch, a stairs area, and street.edge on the same side as the main door unless the user declined them. Room ids must be stable slugs (kitchen, bed-1, porch, stairs). Coordinates are meters on a 0.5 m grid.",
  switch_design:
    "Show one of the three saved designs on the canvas. Incremental edits apply to the visible design. After generating all three, switch to variant 1 unless the user asked for another.",
  add_room:
    "Add a single axis-aligned room rectangle. Coordinates are meters from the plot origin (top-left).",
  update_room:
    "Move or resize one room by id. Does not push shared walls into neighbors — use resize_wall for that.",
  remove_room: "Remove a room and any openings or furniture attached to it.",
  add_opening:
    "Add a door or window on a room edge. offset is meters from the start of that edge (west end for north/south, north end for east/west).",
  remove_opening: "Remove a door or window by id.",
  add_furniture:
    "Add a labeled furniture block inside a room. x/y are relative to the room origin, not the plot.",
  remove_furniture: "Remove a furniture item by id.",
  resize_wall:
    "Move one wall of a room. Neighbors that share that wall move with it. Prefer this over update_room when stretching a room against another. Provide position (plot meters) or delta (positive = east/south).",
  replace_furniture:
    "Swap an existing furniture piece for a catalog object (bed, sofa, table, desk, wardrobe, counter, stove, sink, fridge, toilet, chair). Keeps the same id and recenters in place.",
  move_furniture:
    "Move furniture inside its room. x/y are meters from the room's top-left, not the plot.",
  resize_furniture: "Change a furniture block's width and height in meters.",
  replace_opening: "Change an existing opening between door and window without moving it.",
  move_opening:
    "Slide a door or window along its wall, or onto another wall of the same room. offset is meters from the start of that edge (west for N/S, north for E/W).",
  resize_opening: "Change a door or window width in meters along the wall.",
  export_png:
    "Download the current floor plan as a PNG image in the user's browser. Optional filename (extension added automatically).",
  export_pdf:
    "Download the current floor plan as a PDF in the user's browser. Optional filename (extension added automatically).",
  generate_3d:
    "Build an interactive 3D dollhouse from the current floor plan (extruded rooms, walls, doors, windows, furniture). Opens the 3D viewer so the user can orbit it and download a GLB. Optional filename for the GLB. Call this when the user asks to see the house in 3D, generate 3D, or export a 3D model.",
};

export const READ_ONLY_TOOLS = new Set<ToolName>([
  "get_brief",
  "get_design_rules",
  "get_floor_plan",
  "ask_user",
]);

export function toWebMcpInputSchema(name: ToolName): Record<string, unknown> {
  const payload = {
    ...toolInputSchemas[name].toJSONSchema({ target: "draft-07" }),
  } as Record<string, unknown>;
  delete payload.$schema;
  return payload;
}
