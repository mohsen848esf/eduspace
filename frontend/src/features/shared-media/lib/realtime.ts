import {
  sharedPlaybackInvalidationSchema,
  sharedPlaybackHealthSchema,
  type SharedPlaybackHealth,
  type SharedPlaybackInvalidation,
} from "../schemas/shared-media.schema";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodePlaybackInvalidation = (
  message: SharedPlaybackInvalidation,
): Uint8Array => encoder.encode(JSON.stringify(sharedPlaybackInvalidationSchema.parse(message)));

export const decodePlaybackInvalidation = (
  payload: Uint8Array | string,
): SharedPlaybackInvalidation | null => {
  try {
    const value = JSON.parse(typeof payload === "string" ? payload : decoder.decode(payload));
    const parsed = sharedPlaybackInvalidationSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const encodePlaybackHealth = (
  message: SharedPlaybackHealth,
): Uint8Array => encoder.encode(JSON.stringify(sharedPlaybackHealthSchema.parse(message)));

export const decodePlaybackHealth = (
  payload: Uint8Array | string,
): SharedPlaybackHealth | null => {
  try {
    const value = JSON.parse(typeof payload === "string" ? payload : decoder.decode(payload));
    const parsed = sharedPlaybackHealthSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
