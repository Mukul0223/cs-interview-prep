import type { ApiRequestError } from "./http";

export function getFieldErrors<K extends string>(
  err: ApiRequestError,
  allowed: readonly K[],
): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  if (!Array.isArray(err.details)) return result;

  for (const item of err.details) {
    if (
      item &&
      typeof item === "object" &&
      "field" in item &&
      "message" in item
    ) {
      const { field, message } = item as { field: unknown; message: unknown };
      if (
        typeof field === "string" &&
        typeof message === "string" &&
        (allowed as readonly string[]).includes(field) &&
        !(field in result)
      ) {
        result[field as K] = message;
      }
    }
  }
  return result;
}
