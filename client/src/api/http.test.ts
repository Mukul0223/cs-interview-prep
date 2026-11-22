import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers,
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("http client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loadHttpModule() {
    return import("./http");
  }

  it("handles a normal success and attaches Bearer token", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        expect(url).toBe("/api/v1/users/me");
        expect(headers.get("Authorization")).toBe("Bearer initial-token");
        return jsonResponse({ id: "u_1", email: "ada@example.com" });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, setAccessToken } = await loadHttpModule();
    setAccessToken("initial-token");

    const data = await apiFetch<{ id: string; email: string }>("/users/me");

    expect(data).toEqual({ id: "u_1", email: "ada@example.com" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("converts an error body into an ApiRequestError with the right code", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Email is invalid",
            details: { field: "email" },
          },
        },
        { status: 422, statusText: "Unprocessable Entity" },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, ApiRequestError } = await loadHttpModule();

    let caught: unknown;
    try {
      await apiFetch("/users", { method: "POST", body: { email: "bad" } });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      name: "ApiRequestError",
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Email is invalid",
      details: { field: "email" },
    });
  });

  it("triggers one refresh on 401 UNAUTHENTICATED and retries once with the new token", async () => {
    let profileAttempts = 0;

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers);

        if (url === "/api/v1/profile") {
          profileAttempts += 1;
          if (profileAttempts === 1) {
            expect(headers.get("Authorization")).toBe("Bearer expired-token");
            return jsonResponse(
              {
                error: {
                  code: "UNAUTHENTICATED",
                  message: "Token expired",
                },
              },
              { status: 401, statusText: "Unauthorized" },
            );
          }

          expect(headers.get("Authorization")).toBe("Bearer fresh-token");
          return jsonResponse({ name: "Grace" });
        }

        if (url === "/api/v1/auth/refresh") {
          expect(init?.method).toBe("POST");
          expect(init?.credentials).toBe("same-origin");
          return jsonResponse({ accessToken: "fresh-token" });
        }

        throw new Error(`Unexpected request to ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, getAccessToken, setAccessToken } = await loadHttpModule();
    setAccessToken("expired-token");

    const profile = await apiFetch<{ name: string }>("/profile");

    expect(profile).toEqual({ name: "Grace" });
    expect(getAccessToken()).toBe("fresh-token");

    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
    expect(profileAttempts).toBe(2);
  });

  it("coalesces three simultaneous 401s into a single refresh call", async () => {
    const refreshGate = deferred<Response>();
    const seenTokensOnRetry: Array<string | null> = [];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        const authHeader = headers.get("Authorization");

        if (url === "/api/v1/auth/refresh") {
          return refreshGate.promise;
        }

        if (authHeader === "Bearer stale-token") {
          return jsonResponse(
            {
              error: {
                code: "UNAUTHENTICATED",
                message: "Access token expired",
              },
            },
            { status: 401, statusText: "Unauthorized" },
          );
        }

        seenTokensOnRetry.push(authHeader);
        return jsonResponse({ endpoint: url, ok: true });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, setAccessToken } = await loadHttpModule();
    setAccessToken("stale-token");

    const p1 = apiFetch<{ endpoint: string }>("/items/1");
    const p2 = apiFetch<{ endpoint: string }>("/items/2");
    const p3 = apiFetch<{ endpoint: string }>("/items/3");

    // Wait a tick so all three initial requests fail and hit refreshAccessToken()
    await vi.waitFor(() => {
      const refreshCount = fetchMock.mock.calls.filter(
        ([url]) => String(url) === "/api/v1/auth/refresh",
      ).length;
      expect(refreshCount).toBe(1);
    });

    refreshGate.resolve(jsonResponse({ accessToken: "refreshed-token" }));

    const results = await Promise.all([p1, p2, p3]);

    expect(results).toEqual([
      { endpoint: "/api/v1/items/1", ok: true },
      { endpoint: "/api/v1/items/2", ok: true },
      { endpoint: "/api/v1/items/3", ok: true },
    ]);
    expect(seenTokensOnRetry).toEqual([
      "Bearer refreshed-token",
      "Bearer refreshed-token",
      "Bearer refreshed-token",
    ]);

    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("does not refresh on 401 INVALID_CREDENTIALS", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        },
        { status: 401, statusText: "Unauthorized" },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, ApiRequestError } = await loadHttpModule();

    let caught: unknown;
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: { email: "ada@example.com", password: "wrong" },
        auth: false,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/login");
  });

  it("throws after one refresh without looping when the retried request returns 401", async () => {
    let secretAttempts = 0;

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers);

        if (url === "/api/v1/secret") {
          secretAttempts += 1;
          expect(headers.get("Authorization")).toBe(
            secretAttempts === 1 ? "Bearer old-token" : "Bearer new-token",
          );
          return jsonResponse(
            {
              error: {
                code: "UNAUTHENTICATED",
                message: "Unauthorized",
              },
            },
            { status: 401, statusText: "Unauthorized" },
          );
        }

        if (url === "/api/v1/auth/refresh") {
          return jsonResponse({ accessToken: "new-token" });
        }

        throw new Error(`Unexpected request to ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch, ApiRequestError, setAccessToken } =
      await loadHttpModule();
    setAccessToken("old-token");

    let caught: unknown;
    try {
      await apiFetch("/secret");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Unauthorized",
    });
    expect(secretAttempts).toBe(2);

    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("clears token, calls onSessionExpired, and throws when refresh fails", async () => {
    const onExpired = vi.fn();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/v1/secret") {
        return jsonResponse(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Session expired",
            },
          },
          { status: 401, statusText: "Unauthorized" },
        );
      }

      if (url === "/api/v1/auth/refresh") {
        return jsonResponse(
          {
            error: {
              code: "INVALID_REFRESH_TOKEN",
              message: "Refresh token invalid",
            },
          },
          { status: 401, statusText: "Unauthorized" },
        );
      }

      throw new Error(`Unexpected request to ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const {
      apiFetch,
      ApiRequestError,
      getAccessToken,
      onSessionExpired,
      setAccessToken,
    } = await loadHttpModule();

    onSessionExpired(onExpired);
    setAccessToken("old-token");

    let caught: unknown;
    try {
      await apiFetch("/secret");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
