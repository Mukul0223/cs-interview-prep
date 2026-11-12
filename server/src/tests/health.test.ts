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

  it("check the current db is test db", async () => {
    const rows = await prisma.$queryRaw<
      { db: string }[]
    >`SELECT current_database() AS db`;
    expect(rows[0].db).toContain("test");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
