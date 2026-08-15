import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  createOrgSchema,
  joinOrgSchema,
} from "../auth.schemas";

describe("Auth Zod validation schemas", () => {
  describe("loginSchema", () => {
    it("validates valid credentials", () => {
      const res = loginSchema.safeParse({ username: "admin", password: "password123" });
      expect(res.success).toBe(true);
    });

    it("rejects empty fields", () => {
      const res = loginSchema.safeParse({ username: "", password: "" });
      expect(res.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("validates matching passwords", () => {
      const res = registerSchema.safeParse({
        full_name: "Jane Doe",
        username: "janedoe",
        email: "jane@example.com",
        password: "SecretPassword123",
        confirmPassword: "SecretPassword123",
      });
      expect(res.success).toBe(true);
    });

    it("rejects mismatched passwords", () => {
      const res = registerSchema.safeParse({
        full_name: "Jane Doe",
        username: "janedoe",
        email: "jane@example.com",
        password: "SecretPassword123",
        confirmPassword: "DifferentPassword123",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("createOrgSchema and joinOrgSchema", () => {
    it("validates valid org names and codes", () => {
      expect(createOrgSchema.safeParse({ name: "EduSpace Academy" }).success).toBe(true);
      expect(joinOrgSchema.safeParse({ codeOrSlug: "EDU-9842" }).success).toBe(true);
    });
  });
});
