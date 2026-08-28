export type InspectionEntityType =
  | "student"
  | "teacher"
  | "mentor"
  | "course"
  | "class"
  | "session"
  | "invoice"
  | "assignment"
  | null;

const INSPECTION_ENTITY_TYPES = new Set<Exclude<InspectionEntityType, null>>([
  "student",
  "teacher",
  "mentor",
  "course",
  "class",
  "session",
  "invoice",
  "assignment",
]);

export function parseInspectionEntityType(
  value: string | null | undefined,
): InspectionEntityType {
  return value && INSPECTION_ENTITY_TYPES.has(value as Exclude<InspectionEntityType, null>)
    ? (value as Exclude<InspectionEntityType, null>)
    : null;
}

export interface InspectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: InspectionEntityType;
  entityId: string | number | null;
}

export interface InspectorViewerProps<T = unknown> {
  data: T;
  isFarsi: boolean;
  onNavigate: (type: InspectionEntityType, id: string | number) => void;
}
