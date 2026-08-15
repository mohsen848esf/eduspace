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

export interface InspectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: InspectionEntityType;
  entityId: string | number | null;
}

export interface InspectorViewerProps<T = any> {
  data: T;
  isFarsi: boolean;
  onNavigate: (type: InspectionEntityType, id: string | number) => void;
}
