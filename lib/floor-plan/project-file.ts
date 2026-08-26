import { emptyBrief, normalizePlan } from "./defaults";
import { briefSchema, floorPlanSchema } from "./schema";
import type { Brief, FloorPlan } from "./types";
import { z } from "zod";

export const PROJECT_FILE_KIND = "openarchitect" as const;
export const PROJECT_FILE_VERSION = 1 as const;

export const projectFileSchema = z.object({
  version: z.literal(PROJECT_FILE_VERSION),
  kind: z.literal(PROJECT_FILE_KIND),
  brief: briefSchema,
  plan: floorPlanSchema,
});

export type ProjectFile = z.infer<typeof projectFileSchema>;

const looseProjectSchema = z.object({
  brief: briefSchema.optional(),
  plan: floorPlanSchema,
});

export function buildProjectFile(brief: Brief, plan: FloorPlan): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    kind: PROJECT_FILE_KIND,
    brief: {
      description: brief.description,
      plotWidthM: brief.plotWidthM,
      plotHeightM: brief.plotHeightM,
      bedroomCount: brief.bedroomCount,
      bathroomCount: brief.bathroomCount,
      notes: [...brief.notes],
      answers: { ...brief.answers },
    },
    plan: normalizePlan(plan),
  };
}

export function parseProjectFile(raw: unknown): { brief: Brief; plan: FloorPlan } {
  const project = projectFileSchema.safeParse(raw);
  if (project.success) {
    return {
      brief: project.data.brief,
      plan: normalizePlan({
        units: "m",
        gridSize: project.data.plan.gridSize,
        plot: project.data.plan.plot,
        street: project.data.plan.street ?? null,
        rooms: project.data.plan.rooms,
        openings: project.data.plan.openings,
        furniture: project.data.plan.furniture,
      }),
    };
  }

  const loose = looseProjectSchema.safeParse(raw);
  if (loose.success) {
    return {
      brief: loose.data.brief ?? emptyBrief(),
      plan: normalizePlan({
        units: "m",
        gridSize: loose.data.plan.gridSize,
        plot: loose.data.plan.plot,
        street: loose.data.plan.street ?? null,
        rooms: loose.data.plan.rooms,
        openings: loose.data.plan.openings,
        furniture: loose.data.plan.furniture,
      }),
    };
  }

  const planOnly = floorPlanSchema.safeParse(raw);
  if (planOnly.success) {
    return {
      brief: emptyBrief(),
      plan: normalizePlan({
        units: "m",
        gridSize: planOnly.data.gridSize,
        plot: planOnly.data.plot,
        street: planOnly.data.street ?? null,
        rooms: planOnly.data.rooms,
        openings: planOnly.data.openings,
        furniture: planOnly.data.furniture,
      }),
    };
  }

  throw new Error(
    "Unrecognized project file. Expect an OpenArchitect JSON export (brief + plan).",
  );
}

export function sanitizeProjectFilename(name?: string) {
  const trimmed = (name ?? "openarchitect-project").trim() || "openarchitect-project";
  const withoutExt = trimmed.replace(/\.json$/i, "");
  const slug = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "openarchitect-project"}.json`;
}

export function downloadProjectFile(brief: Brief, plan: FloorPlan, filename?: string) {
  const payload = buildProjectFile(brief, plan);
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeProjectFilename(filename);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return sanitizeProjectFilename(filename);
}

export async function readProjectFile(file: File): Promise<{ brief: Brief; plan: FloorPlan }> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error("File is not valid JSON.");
  }
  return parseProjectFile(raw);
}
