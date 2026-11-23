type SessionExpiredCallback = () => void;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

export interface ApiFetchOptions {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  headers?: HeadersInit;
  signal?: AbortSignal;
  _retried?: boolean;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiRequestError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/+$/,
  "",
);

const AUTH_NO_RETRY_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
]);

let accessToken: string | null = null;
let sessionExpiredHandler: SessionExpiredCallback | null = null;
let inflightRefresh: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function onSessionExpired(callback: SessionExpiredCallback): void {
  sessionExpiredHandler = callback;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function shouldSkip401Retry(path: string, retried?: boolean): boolean {
  if (retried) return true;
  const normalized = normalizePath(path).split("?")[0];
  return AUTH_NO_RETRY_PATHS.has(normalized);
}

async function parseErrorResponse(response: Response): Promise<{
  code: string;
  message: string;
  details?: unknown;
}> {
  const fallbackMessage =
    response.statusText || `Request failed (${response.status})`;

  let rawBody: unknown;
  try {
    rawBody = await response.json();
  } catch {
    return {
      code: "HTTP_ERROR",
      message: fallbackMessage,
    };
  }

  if (rawBody && typeof rawBody === "object" && "error" in rawBody) {
    const errObj = (rawBody as { error?: ApiErrorPayload }).error;
    if (errObj && typeof errObj === "object") {
      return {
        code:
          typeof errObj.code === "string" && errObj.code
            ? errObj.code
            : "HTTP_ERROR",
        message:
          typeof errObj.message === "string" && errObj.message
            ? errObj.message
            : fallbackMessage,
        details: errObj.details,
      };
    }
  }

  return {
    code: "HTTP_ERROR",
    message: fallbackMessage,
    details: rawBody,
  };
}

export async function refreshAccessToken(): Promise<string | null> {
  if (inflightRefresh) {
    return inflightRefresh;
  }

  inflightRefresh = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        setAccessToken(null);
        sessionExpiredHandler?.();
        return null;
      }

      const payload = (await response.json()) as {
        accessToken?: string | null;
      };
      const nextToken = payload.accessToken ?? null;

      if (!nextToken) {
        setAccessToken(null);
        sessionExpiredHandler?.();
        return null;
      }

      setAccessToken(nextToken);
      return nextToken;
    } catch {
      setAccessToken(null);
      sessionExpiredHandler?.();
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    headers: customHeaders,
    signal,
    _retried = false,
  } = options;

  const url = `${API_BASE_URL}${normalizePath(path)}`;
  const headers = new Headers(customHeaders);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const hasJsonBody = body !== undefined && !(body instanceof FormData);
  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const parsedError = await parseErrorResponse(response);

    if (
      response.status === 401 &&
      parsedError.code === "UNAUTHENTICATED" &&
      !shouldSkip401Retry(path, _retried)
    ) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return apiFetch<T>(path, {
          ...options,
          _retried: true,
        });
      }
    }

    throw new ApiRequestError({
      status: response.status,
      code: parsedError.code,
      message: parsedError.message,
      details: parsedError.details,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
