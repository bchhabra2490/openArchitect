import { z } from "zod";
import { EDGES, OPENING_KINDS, ROOM_TYPES } from "./types";

const idSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9_-]*$/i, "Use a short id like kitchen or bed-1");

export const roomInputSchema = z.object({
  id: idSchema.optional().describe("Stable id, e.g. kitchen or bed-1"),
  name: z.string().min(1).describe("Human label shown on the canvas"),
  type: z.enum(ROOM_TYPES),
  x: z.number().describe("Meters from the plot's left (west) edge"),
  y: z.number().describe("Meters from the plot's top (north) edge"),
  width: z.number().positive().describe("Room width in meters"),
  height: z.number().positive().describe("Room height in meters"),
});

export const openingInputSchema = z.object({
  id: idSchema.optional(),
  kind: z.enum(OPENING_KINDS),
  roomId: z.string().describe("Id of the room this opening belongs to"),
  edge: z.enum(EDGES).describe("Wall: north is top of the canvas"),
  offset: z
    .number()
    .nonnegative()
    .describe("Meters along the edge from its start (west for N/S, north for E/W)"),
  width: z.number().positive().describe("Opening width in meters"),
});

export const furnitureInputSchema = z.object({
  id: idSchema.optional(),
  roomId: z.string(),
  name: z.string().min(1),
  kind: z
    .string()
    .min(1)
    .describe("bed, sofa, table, counter, toilet, sink, stove, wardrobe, desk, other"),
  x: z.number().describe("Meters from the room's left edge"),
  y: z.number().describe("Meters from the room's top edge"),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const updateBriefInputSchema = z.object({
  description: z.string().optional(),
  plotWidthM: z.number().positive().optional(),
  plotHeightM: z.number().positive().optional(),
  bedroomCount: z.number().int().nonnegative().optional(),
  bathroomCount: z.number().int().nonnegative().optional(),
  notes: z.array(z.string()).optional(),
  answers: z.record(z.string(), z.string()).optional(),
});

export const askUserInputSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().min(1),
        type: z.enum(["text", "choice", "number"]),
        options: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(6),
});

export const setPlotInputSchema = z.object({
  width: z.number().positive().describe("Plot width in meters"),
  height: z.number().positive().describe("Plot height in meters"),
});

export const designIndexSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const switchDesignInputSchema = z.object({
  variant: designIndexSchema.describe("Which of the three designs to show on the canvas"),
});

export const applyLayoutInputSchema = z.object({
  variant: designIndexSchema
    .optional()
    .describe(
      "Which of the 3 designs to write (1, 2, or 3). Pass this when generating alternatives. Omit to replace the currently visible design.",
    ),
  label: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe("Short name for this alternative, e.g. Day-night split"),
  concept: z
    .string()
    .min(1)
    .max(180)
    .optional()
    .describe("One sentence on how this layout differs from the other two"),
  plot: z
    .object({
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  street: z
    .object({
      edge: z
        .enum(EDGES)
        .describe("Plot edge the street runs along — the same side as the main entrance"),
      width: z.number().positive().optional().describe("Street carriageway width in meters"),
    })
    .nullable()
    .optional(),
  rooms: z.array(roomInputSchema).min(1),
  openings: z.array(openingInputSchema).optional(),
  furniture: z.array(furnitureInputSchema).optional(),
});

export const addRoomInputSchema = roomInputSchema;

export const updateRoomInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(ROOM_TYPES).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export const removeByIdInputSchema = z.object({
  id: z.string(),
});

export const addOpeningInputSchema = openingInputSchema;
export const addFurnitureInputSchema = furnitureInputSchema;

export const resizeWallInputSchema = z
  .object({
    roomId: z.string().describe("Room whose wall to move"),
    edge: z
      .enum(EDGES)
      .describe("Which wall: north is the top of the canvas, east is the right"),
    position: z
      .number()
      .optional()
      .describe(
        "New plot coordinate of that wall in meters (x for east/west, y for north/south)",
      ),
    delta: z
      .number()
      .optional()
      .describe(
        "Meters to shift the wall from where it is now. Positive moves east or south.",
      ),
  })
  .refine((value) => value.position != null || value.delta != null, {
    message: "Provide position (absolute meters) or delta (meters to move).",
  });

export const replaceFurnitureInputSchema = z.object({
  id: z.string().describe("Furniture id from get_floor_plan"),
  kind: z
    .string()
    .min(1)
    .describe(
      "Catalog kind: bed, sofa, table, desk, wardrobe, counter, stove, sink, fridge, toilet, chair",
    ),
});

export const moveFurnitureInputSchema = z.object({
  id: z.string(),
  x: z.number().describe("Meters from the room's left (west) edge"),
  y: z.number().describe("Meters from the room's top (north) edge"),
});

export const resizeFurnitureInputSchema = z.object({
  id: z.string(),
  width: z.number().positive().describe("New width in meters"),
  height: z.number().positive().describe("New height in meters"),
});

export const replaceOpeningInputSchema = z.object({
  id: z.string().describe("Door or window id from get_floor_plan"),
  kind: z.enum(OPENING_KINDS).describe("door or window"),
});

export const moveOpeningInputSchema = z.object({
  id: z.string().describe("Door or window id from get_floor_plan"),
  offset: z
    .number()
    .nonnegative()
    .describe("Meters along the edge from its start (west for N/S, north for E/W)"),
  edge: z
    .enum(EDGES)
    .optional()
    .describe("Move onto another wall of the same room. Omit to stay on the current wall."),
});

export const resizeOpeningInputSchema = z.object({
  id: z.string().describe("Door or window id from get_floor_plan"),
  width: z.number().positive().describe("New opening width in meters along the wall"),
});

export const exportPlanInputSchema = z.object({
  filename: z
    .string()
    .optional()
    .describe("Download name without path, e.g. 3bhk-ground-floor. Extension is added."),
});

export const emptyInputSchema = z.object({});

export const briefSchema = z.object({
  description: z.string(),
  plotWidthM: z.number().optional(),
  plotHeightM: z.number().optional(),
  bedroomCount: z.number().optional(),
  bathroomCount: z.number().optional(),
  notes: z.array(z.string()),
  answers: z.record(z.string(), z.string()),
});

export const floorPlanSchema = z.object({
  units: z.literal("m"),
  gridSize: z.number().positive(),
  plot: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  street: z
    .object({
      edge: z.enum(EDGES),
      width: z.number().positive(),
    })
    .nullable()
    .optional(),
  rooms: z.array(roomInputSchema.extend({ id: z.string().min(1) })),
  openings: z.array(openingInputSchema.extend({ id: z.string().min(1) })),
  furniture: z.array(furnitureInputSchema.extend({ id: z.string().min(1) })),
});

export const toolInputSchemas = {
  get_brief: emptyInputSchema,
  get_design_rules: emptyInputSchema,
  update_brief: updateBriefInputSchema,
  ask_user: askUserInputSchema,
  get_floor_plan: emptyInputSchema,
  set_plot: setPlotInputSchema,
  apply_layout: applyLayoutInputSchema,
  switch_design: switchDesignInputSchema,
  add_room: addRoomInputSchema,
  update_room: updateRoomInputSchema,
  remove_room: removeByIdInputSchema,
  add_opening: addOpeningInputSchema,
  remove_opening: removeByIdInputSchema,
  add_furniture: addFurnitureInputSchema,
  remove_furniture: removeByIdInputSchema,
  resize_wall: resizeWallInputSchema,
  replace_furniture: replaceFurnitureInputSchema,
  move_furniture: moveFurnitureInputSchema,
  resize_furniture: resizeFurnitureInputSchema,
  replace_opening: replaceOpeningInputSchema,
  move_opening: moveOpeningInputSchema,
  resize_opening: resizeOpeningInputSchema,
  export_png: exportPlanInputSchema,
  export_pdf: exportPlanInputSchema,
  generate_3d: exportPlanInputSchema,
} as const;

export type ToolName = keyof typeof toolInputSchemas;
