import type { AcademyClass } from "../../dashboard/api/crm.api";

/**
 * Returns the active room code for a class.
 * Priority:
 * 1. latest_session.active_room_code
 * 2. Fallback to legacy class.room
 */
export function getLiveRoomCode(cls: AcademyClass): string | null {
  if (cls.latest_session?.active_room_code) {
    return cls.latest_session.active_room_code;
  }
  return cls.room || null;
}
