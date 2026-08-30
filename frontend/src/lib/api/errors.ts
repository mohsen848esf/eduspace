import axios from "axios";

export type ApiErrorPayload = Record<string, unknown> & {
  0?: string;
  detail?: string;
  error?: string;
  name?: string[];
  non_field_errors?: string[];
};

function stringifyErrorValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value
      .map(stringifyErrorValue)
      .filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const payload = error.response?.data;
  const direct = stringifyErrorValue(payload?.error ?? payload?.detail);
  if (direct) return direct;

  if (payload) {
    const validationMessage = Object.values(payload)
      .map(stringifyErrorValue)
      .filter((part): part is string => Boolean(part))
      .join(" ");
    if (validationMessage) return validationMessage;
  }

  return error.message || fallback;
}

export function getApiErrorData(error: unknown): ApiErrorPayload | undefined {
  return axios.isAxiosError<ApiErrorPayload>(error)
    ? error.response?.data
    : undefined;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
