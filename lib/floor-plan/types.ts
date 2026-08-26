export const ROOM_TYPES = [
  "bedroom",
  "bathroom",
  "kitchen",
  "living",
  "dining",
  "hallway",
  "closet",
  "balcony",
  "office",
  "laundry",
  "stairs",
  "porch",
  "other",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export const EDGES = ["north", "south", "east", "west"] as const;
export type Edge = (typeof EDGES)[number];

export const OPENING_KINDS = ["door", "window"] as const;
export type OpeningKind = (typeof OPENING_KINDS)[number];

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Opening {
  id: string;
  kind: OpeningKind;
  roomId: string;
  edge: Edge;
  offset: number;
  width: number;
}

export interface FurnitureItem {
  id: string;
  roomId: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Street {
  edge: Edge;
  width: number;
}

export interface FloorPlan {
  units: "m";
  gridSize: number;
  plot: { width: number; height: number };
  street: Street | null;
  rooms: Room[];
  openings: Opening[];
  furniture: FurnitureItem[];
}

export interface Brief {
  description: string;
  plotWidthM?: number;
  plotHeightM?: number;
  bedroomCount?: number;
  bathroomCount?: number;
  notes: string[];
  answers: Record<string, string>;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  type: "text" | "choice" | "number";
  options?: string[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
}

export interface CommandResult {
  plan: FloorPlan;
  brief: Brief;
  issues: ValidationIssue[];
  summary: string;
  exportFile?: PlanExport;
  view3d?: { filename: string };
  questions?: ClarifyingQuestion[];
  displayLayers?: Partial<{
    roomColors: boolean;
    doors: boolean;
    objects: boolean;
  }>;
}

export const EXPORT_FORMATS = ["png", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface PlanExport {
  format: ExportFormat | "json";
  filename: string;
}

export type StudioClipboard =
  | { type: "furniture"; item: FurnitureItem }
  | { type: "opening"; opening: Opening }
  | {
      type: "room";
      room: Room;
      openings: Opening[];
      furniture: FurnitureItem[];
    };
