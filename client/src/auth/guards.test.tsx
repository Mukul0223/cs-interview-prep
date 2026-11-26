// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { AuthContext, type AuthContextValue } from "./authContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";

afterEach(cleanup);

const admin = {
  id: "1",
  email: "a@x.com",
  displayName: "Ada",
  role: "ADMIN" as const,
};
const regular = { ...admin, role: "USER" as const };

function makeAuth(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: "unauthenticated",
    user: null,
    login: async () => {
      throw new Error("not used");
    },
    register: async () => {
      throw new Error("not used");
    },
    logout: async () => {},
    ...overrides,
  };
}

function renderAt(path: string, auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<p>PROFILE PAGE</p>} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<p>ADMIN PAGE</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects an unauthenticated visitor to the login page", () => {
    renderAt("/profile", makeAuth({}));
    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
    expect(screen.queryByText("PROFILE PAGE")).toBeNull();
  });

  it("renders the page for an authenticated user", () => {
    renderAt("/profile", makeAuth({ status: "authenticated", user: regular }));
    expect(screen.getByText("PROFILE PAGE")).toBeTruthy();
  });

  it("shows a spinner and does not redirect while loading", () => {
    renderAt("/profile", makeAuth({ status: "loading" }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("LOGIN PAGE")).toBeNull();
    expect(screen.queryByText("PROFILE PAGE")).toBeNull();
  });
});

describe("AdminRoute", () => {
  it("shows Permission denied to a regular user", () => {
    renderAt("/admin", makeAuth({ status: "authenticated", user: regular }));
    expect(screen.getByText("Permission denied")).toBeTruthy();
    expect(screen.queryByText("ADMIN PAGE")).toBeNull();
  });

  it("renders the page for an admin", () => {
    renderAt("/admin", makeAuth({ status: "authenticated", user: admin }));
    expect(screen.getByText("ADMIN PAGE")).toBeTruthy();
  });

  it("redirects an unauthenticated visitor to the login page", () => {
    renderAt("/admin", makeAuth({}));
    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
  });
});
