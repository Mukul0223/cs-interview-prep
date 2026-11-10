import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("Application & Database Tests", () => {
  it("GET /api/v1/health returns 200 and { status: 'ok' }", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("an unknown path returns 404 with error.code === 'NOT_FOUND'", async () => {
    const response = await request(app).get(
      "/api/v1/this-route-does-not-exist",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("prisma.user.count() returns 0, proving the tests hit the migrated test database", async () => {
    const count = await prisma.user.count();

    expect(count).toBe(0);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
