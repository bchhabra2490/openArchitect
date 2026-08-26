import type { Brief, FloorPlan, Opening, Room, RoomType, ValidationIssue } from "./types";
import {
  briefOmitsPorch,
  briefOmitsStairs,
  briefOmitsStreet,
  hasPorchRoom,
  hasStairsRoom,
} from "./brief-flags";

const EPS = 0.01;
const TOUCH = 0.5;

/** NBC 2016-aligned minima used for schematic residential plans. */
export const ROOM_MINIMA: Record<
  RoomType,
  { area: number; minSide: number; label: string }
> = {
  living: { area: 9.5, minSide: 2.4, label: "Living (primary habitable)" },
  dining: { area: 7.5, minSide: 2.4, label: "Dining" },
  bedroom: { area: 7.5, minSide: 2.4, label: "Bedroom" },
  office: { area: 7.5, minSide: 2.4, label: "Study / office" },
  kitchen: { area: 5.0, minSide: 1.8, label: "Kitchen" },
  bathroom: { area: 2.8, minSide: 1.2, label: "Combined bath + WC" },
  hallway: { area: 1.0, minSide: 1.0, label: "Corridor / passage" },
  laundry: { area: 1.8, minSide: 1.2, label: "Laundry" },
  closet: { area: 1.0, minSide: 0.9, label: "Closet / store" },
  balcony: { area: 1.5, minSide: 1.0, label: "Balcony" },
  stairs: { area: 2.0, minSide: 0.9, label: "Stair" },
  porch: { area: 2.5, minSide: 1.2, label: "Entrance porch" },
  other: { area: 3.0, minSide: 1.5, label: "Utility / other" },
};

export const DOOR_MIN_WIDTH: Record<RoomType, number> = {
  living: 0.9,
  dining: 0.9,
  bedroom: 0.9,
  office: 0.9,
  kitchen: 0.8,
  bathroom: 0.75,
  hallway: 0.9,
  laundry: 0.75,
  closet: 0.75,
  balcony: 0.9,
  stairs: 0.9,
  porch: 1.0,
  other: 0.75,
};

export const MAIN_DOOR_MIN_WIDTH = 1.0;
export const WINDOW_TO_FLOOR_RATIO = 0.1;
export const KITCHEN_WINDOW_MIN_M2 = 1.0;
export const BATH_VENT_MIN_M2 = 0.37;
export const DEFAULT_DOOR_WIDTHS = {
  living: 0.9,
  bedroom: 0.9,
  kitchen: 0.8,
  bathroom: 0.75,
} as const;

const HABITABLE: RoomType[] = ["living", "dining", "bedroom", "office", "kitchen"];
const CIRCULATION: RoomType[] = ["living", "dining", "hallway"];

export const DESIGN_RULES_FOR_AGENTS = `Follow these schematic residential rules (NBC 2016 Part 3/4 and Part 8 lighting as commonly applied in India; NKBA kitchen planning for work layout). Local bye-laws can be stricter. These are minima — comfortable 3BHK rooms should exceed them.

Public vs private
- Cluster living, dining, and kitchen as the public zone near the entry.
- Cluster bedrooms as a private zone, reached from a hallway or living — never through another bedroom.
- Put the common bathroom on a hallway, not opening into the kitchen or dining.
- An attached bath may open only into its bedroom.
- Keep wet rooms (kitchen, baths, laundry) sharing walls when the plot allows, so plumbing stacks.

Living / dining
- Living is the primary habitable room: at least 9.5 m², neither side under 2.4 m. Prefer ~3.0 m min side.
- Dining at least 7.5 m². Place it next to kitchen and living (open plan is fine).
- Entry into the dwelling should land in living or a lobby, not a bedroom.
- Main / plot-edge living door at least 1.0 m wide.

Bedrooms
- At least 7.5 m² and 2.4 m min side (NBC other habitable rooms). Aim 9.5 m²+; master ~12 m² if the plot allows.
- Door 0.9 m. Place on the circulation side, not on an exterior corner if it fights furniture.
- Every bedroom needs a window on an exterior (plot-edge) wall. Window area about 1/10 of floor area (e.g. 1.2 m wide on a 12 m² room).
- Do not walk through one bedroom to reach another.
- Place a closet on the bedroom or immediately off it. Leave ~0.6 m clear beside a bed.

Kitchen
- Separate kitchen at least 5.0 m², min side 1.8 m. Kitchen-plus-dining combined at least 7.5 m².
- Door 0.8 m if enclosed; open to dining/living is preferred.
- Window at least 1.0 m², on an exterior wall, plus space for a stove against that or an internal wet wall.
- Work triangle (sink, stove, fridge): each leg 1.2–2.7 m, sum ≤ 7.9 m. Do not run the main house circulation through the triangle.
- Put kitchen next to dining/living, not between bedrooms.

Bathrooms
- Combined bath+WC at least 2.8 m², min side 1.2 m. Door 0.75 m, preferably swinging out or sliding so a fall cannot block it.
- Ventilation opening at least 0.37 m² (window or shaft). Prefer an exterior wall.
- One bath per two bedrooms as a default if the user did not specify; at least one common bath reachable without entering a bedroom.
- Do not open a WC directly into the kitchen.

Hallways / doors / windows
- Corridor min width 1.0 m (residential). Prefer 1.1–1.2 m.
- Internal habitable doors 0.9 m, kitchen 0.8 m, bath 0.75 m, unit entry 1.0 m.
- Habitable rooms need daylight to the outside (or a verandah ≤ 2.4 m deep). Put windows on plot-edge walls.
- Typical window 1.2 m wide on exterior walls; typical interior door 0.9 m.

Laundry, closet, balcony, office
- Laundry next to kitchen or baths. Closets accessed from bedrooms. Balcony off living or a bedroom, min ~1.5 m². Study follows bedroom size rules.

Site defaults (always, unless the user said otherwise)
- Entrance porch: a 1.5 m deep verandah/porch on the street side, in front of living or a lobby. Main door (1.0 m) on the porch, facing the street. Inner door from porch into living/hallway.
- Stairs: reserve a stair well (~1.0 × 2.5 m) even on a single-storey house (terrace / future floor). Place it next to the porch, hallway, or living — never inside a bedroom.
- Street: draw the access street on the same plot edge as the main entrance so the door looks out to the road. Default south if the entrance side is unknown. Mention facing/frontage only if the user named it.

Furniture (schematic)
- Queen bed ~2.1 × 1.6 m; sofa ~2.2 × 0.9 m; dining table ~1.5 × 0.9 m; kitchen counter depth 0.6 m.
- Keep furniture inside the room with 0.5 m+ circulation where people walk.

After drawing, call get_standards_check (or get_floor_plan) and fix every design error and warning you can.`;

function area(room: Room) {
  return room.width * room.height;
}

function minSide(room: Room) {
  return Math.min(room.width, room.height);
}

function overlap1d(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

export function sharedEdgeLength(a: Room, b: Room): number {
  const verticalTouch =
    Math.abs(a.x + a.width - b.x) < EPS || Math.abs(b.x + b.width - a.x) < EPS;
  if (verticalTouch) {
    return overlap1d(a.y, a.y + a.height, b.y, b.y + b.height);
  }
  const horizontalTouch =
    Math.abs(a.y + a.height - b.y) < EPS || Math.abs(b.y + b.height - a.y) < EPS;
  if (horizontalTouch) {
    return overlap1d(a.x, a.x + a.width, b.x, b.x + b.width);
  }
  return 0;
}

function isAdjacent(a: Room, b: Room) {
  return sharedEdgeLength(a, b) >= TOUCH;
}

function onPlotEdge(room: Room, edge: Opening["edge"], plot: FloorPlan["plot"]) {
  switch (edge) {
    case "north":
      return room.y <= EPS;
    case "south":
      return room.y + room.height >= plot.height - EPS;
    case "west":
      return room.x <= EPS;
    case "east":
      return room.x + room.width >= plot.width - EPS;
  }
}

function windowArea(room: Room, openings: Opening[]) {
  return openings
    .filter((opening) => opening.roomId === room.id && opening.kind === "window")
    .reduce((sum, opening) => sum + opening.width * 1.2, 0);
}

function doorsFor(room: Room, openings: Opening[]) {
  return openings.filter((opening) => opening.roomId === room.id && opening.kind === "door");
}

export function checkDesignRules(plan: FloorPlan, brief?: Brief): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rooms = plan.rooms;
  if (rooms.length === 0) return issues;

  for (const room of rooms) {
    const minima = ROOM_MINIMA[room.type];
    if (area(room) + EPS < minima.area) {
      issues.push({
        severity: "error",
        code: "room_too_small",
        entityId: room.id,
        message: `${room.name} is ${area(room).toFixed(1)} m²; ${minima.label} needs ≥ ${minima.area} m² (NBC-aligned).`,
      });
    }
    if (minSide(room) + EPS < minima.minSide) {
      issues.push({
        severity: "error",
        code: "room_too_narrow",
        entityId: room.id,
        message: `${room.name} is ${minSide(room)} m on its short side; ${minima.label} needs ≥ ${minima.minSide} m.`,
      });
    }

    if (HABITABLE.includes(room.type)) {
      const windows = plan.openings.filter(
        (opening) => opening.roomId === room.id && opening.kind === "window",
      );
      if (windows.length === 0) {
        issues.push({
          severity: "warning",
          code: "missing_window",
          entityId: room.id,
          message: `${room.name} is habitable and has no window. NBC expects daylight/ventilation to outside air.`,
        });
      } else {
        const exterior = windows.some((opening) =>
          onPlotEdge(room, opening.edge, plan.plot),
        );
        if (!exterior) {
          issues.push({
            severity: "warning",
            code: "window_not_exterior",
            entityId: room.id,
            message: `${room.name} windows are not on a plot-edge wall, so they may not meet natural-light rules.`,
          });
        }
        const needed =
          room.type === "kitchen"
            ? Math.max(KITCHEN_WINDOW_MIN_M2, area(room) * WINDOW_TO_FLOOR_RATIO)
            : area(room) * WINDOW_TO_FLOOR_RATIO;
        const provided = windowArea(room, plan.openings);
        if (provided + EPS < needed) {
          issues.push({
            severity: "warning",
            code: "window_too_small",
            entityId: room.id,
            message: `${room.name} window area ~${provided.toFixed(1)} m²; aim for ≥ ${needed.toFixed(1)} m² (~1/10 floor area${room.type === "kitchen" ? ", kitchen min 1.0 m²" : ""}).`,
          });
        }
      }
    }

    if (room.type === "bathroom") {
      const vents = plan.openings.filter(
        (opening) => opening.roomId === room.id && opening.kind === "window",
      );
      const ventArea = windowArea(room, vents);
      if (vents.length === 0 || ventArea + EPS < BATH_VENT_MIN_M2) {
        issues.push({
          severity: "warning",
          code: "bath_ventilation",
          entityId: room.id,
          message: `${room.name} needs a vent/window ≥ ${BATH_VENT_MIN_M2} m² (or a shaft/exhaust).`,
        });
      }
    }

    const minDoor = DOOR_MIN_WIDTH[room.type];
    for (const door of doorsFor(room, plan.openings)) {
      const required =
        (room.type === "living" || room.type === "porch") &&
        onPlotEdge(room, door.edge, plan.plot)
          ? MAIN_DOOR_MIN_WIDTH
          : minDoor;
      if (door.width + EPS < required) {
        issues.push({
          severity: "warning",
          code: "door_too_narrow",
          entityId: door.id,
          message: `Door on ${room.name} is ${door.width} m; use ≥ ${required} m.`,
        });
      }
    }
  }

  const circulation = rooms.filter((room) => CIRCULATION.includes(room.type));
  for (const bedroom of rooms.filter((room) => room.type === "bedroom")) {
    const fromCirculation = circulation.some((room) => isAdjacent(bedroom, room));
    if (!fromCirculation) {
      issues.push({
        severity: "warning",
        code: "bedroom_no_circulation",
        entityId: bedroom.id,
        message: `${bedroom.name} should share a wall with living, dining, or a hallway — not be reached only through another bedroom.`,
      });
    }
  }

  const kitchens = rooms.filter((room) => room.type === "kitchen");
  const social = rooms.filter((room) => room.type === "living" || room.type === "dining");
  for (const kitchen of kitchens) {
    if (social.length > 0 && !social.some((room) => isAdjacent(kitchen, room))) {
      issues.push({
        severity: "warning",
        code: "kitchen_not_social",
        entityId: kitchen.id,
        message: `${kitchen.name} should sit next to living or dining.`,
      });
    }
  }

  const baths = rooms.filter((room) => room.type === "bathroom");
  const bathAccessTypes: RoomType[] = ["bedroom", "hallway", "living"];
  for (const bath of baths) {
    const fromPrivate = rooms.some(
      (room) => bathAccessTypes.includes(room.type) && isAdjacent(bath, room),
    );
    if (!fromPrivate) {
      issues.push({
        severity: "warning",
        code: "bath_access",
        entityId: bath.id,
        message: `${bath.name} should open from a bedroom (attached) or a hallway/living (common), not from the kitchen.`,
      });
    }
  }

  if (rooms.length > 0) {
    if (!brief || !briefOmitsStreet(brief)) {
      if (!plan.street) {
        issues.push({
          severity: "warning",
          code: "missing_street",
          message: "Place the access street on the same plot edge as the main entrance.",
        });
      }
    }
    if (!brief || !briefOmitsPorch(brief)) {
      if (!hasPorchRoom(plan)) {
        issues.push({
          severity: "warning",
          code: "missing_porch",
          message: "Add an entrance porch/verandah on the street side unless the brief says not to.",
        });
      }
    }
    if (!brief || !briefOmitsStairs(brief)) {
      if (!hasStairsRoom(plan)) {
        issues.push({
          severity: "warning",
          code: "missing_stairs",
          message: "Reserve a stairs area (to an upper floor or terrace) unless the brief says not to.",
        });
      }
    }
  }

  const porchRooms = rooms.filter((room) => room.type === "porch");
  const entryAccess = rooms.filter(
    (room) => room.type === "living" || room.type === "hallway" || room.type === "dining",
  );
  for (const porch of porchRooms) {
    if (entryAccess.length > 0 && !entryAccess.some((room) => isAdjacent(porch, room))) {
      issues.push({
        severity: "warning",
        code: "porch_access",
        entityId: porch.id,
        message: `${porch.name} should share a wall with living or a hallway.`,
      });
    }
    if (plan.street && !onPlotEdge(porch, plan.street.edge, plan.plot)) {
      issues.push({
        severity: "warning",
        code: "porch_not_on_street",
        entityId: porch.id,
        message: `${porch.name} should sit on the ${plan.street.edge} plot edge so the entrance faces the street.`,
      });
    }
  }

  const stairRooms = rooms.filter((room) => room.type === "stairs");
  const stairAccess = rooms.filter(
    (room) =>
      room.type === "living" ||
      room.type === "hallway" ||
      room.type === "porch" ||
      room.type === "dining",
  );
  for (const stair of stairRooms) {
    if (stairAccess.length > 0 && !stairAccess.some((room) => isAdjacent(stair, room))) {
      issues.push({
        severity: "warning",
        code: "stairs_access",
        entityId: stair.id,
        message: `${stair.name} should open from living, a hallway, or the porch — not from a bedroom.`,
      });
    }
  }

  return issues;
}

export const DESIGN_RULES_REFERENCE = [
  {
    section: "Living",
    source: "NBC 2016 habitable-room minima",
    rules: [
      "≥ 9.5 m² and 2.4 m min width as the primary room",
      "Entry should arrive here or in a lobby, not a bedroom",
      "Main door on the plot edge ≥ 1.0 m",
    ],
  },
  {
    section: "Dining",
    source: "NBC 2016 + common planning",
    rules: [
      "≥ 7.5 m²",
      "Share a wall with kitchen and living",
    ],
  },
  {
    section: "Bedroom",
    source: "NBC 2016 other habitable rooms",
    rules: [
      "≥ 7.5 m², 2.4 m min side (aim 9.5 m²+)",
      "Door 0.9 m from hallway or living",
      "Exterior window ~1/10 of floor area",
      "No bedroom-through-bedroom circulation",
    ],
  },
  {
    section: "Kitchen",
    source: "NBC 2016 + NKBA work triangle",
    rules: [
      "≥ 5.0 m², 1.8 m min side (7.5 m² if combined with dining)",
      "Door 0.8 m if enclosed; window ≥ 1.0 m²",
      "Next to dining/living; sink–stove–fridge legs 1.2–2.7 m",
    ],
  },
  {
    section: "Bathroom",
    source: "NBC 2016 bath + WC combined",
    rules: [
      "≥ 2.8 m², 1.2 m min side, door 0.75 m",
      "Vent ≥ 0.37 m²",
      "Common bath off hallway; attached bath off bedroom only",
    ],
  },
  {
    section: "Hallway & openings",
    source: "NBC 2016 corridors, doors, Part 8 light",
    rules: [
      "Corridor ≥ 1.0 m",
      "Habitable doors 0.9 m; kitchen 0.8 m; bath 0.75 m",
      "Windows on exterior walls for habitable rooms",
    ],
  },
  {
    section: "Porch, stairs & street",
    source: "Site planning defaults",
    rules: [
      "Entrance porch ~1.5 m deep on the street side unless the user declined it",
      "Main door 1.0 m on the porch, looking out to the street",
      "Stairs ~1.0 × 2.5 m next to porch/hallway (terrace or upper floor)",
      "Street aligned with the entrance so the door faces the road",
    ],
  },
] as const;
