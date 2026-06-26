import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

const goodSignup = {
  name: "Owner One",
  orgName: "Acme Clinic",
  email: "owner@acme.test",
  password: "hunter2pass",
  legalAuthorityConfirmed: true,
};

describe("POST /api/auth/signup", () => {
  it("rejects when consent is not confirmed", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...goodSignup, legalAuthorityConfirmed: false });
    expect(res.status).toBe(400);
  });

  it("creates org + owner, stamps consent, sets cookie", async () => {
    const res = await request(app).post("/api/auth/signup").send(goodSignup);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("owner@acme.test");
    expect(res.body.organization.name).toBe("Acme Clinic");
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("sp_token=");
    expect(cookie).toContain("HttpOnly");
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/auth/signup").send(goodSignup);
    const res = await request(app).post("/api/auth/signup").send(goodSignup);
    expect(res.status).toBe(409);
  });
});

describe("login / me / logout", () => {
  it("logs in and reads the session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(goodSignup);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("owner@acme.test");
  });

  it("rejects /me without a cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects wrong password", async () => {
    await request(app).post("/api/auth/signup").send(goodSignup);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: goodSignup.email, password: "wrongpass1" });
    expect(res.status).toBe(401);
  });

  it("logout clears the cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(goodSignup);
    await agent.post("/api/auth/logout");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});
