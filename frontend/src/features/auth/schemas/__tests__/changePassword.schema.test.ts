import { describe, expect, it } from "vitest";
import { buildChangePasswordSchema } from "../auth.schema";

const t = (key: string) => key;
const schema = buildChangePasswordSchema(t);

describe("change-password validation", () => {
  it("accepts a strong matching new password", () => {
    expect(schema.safeParse({
      current_password: "CurrentPassword123!",
      new_password: "NewPassword123!",
      confirm_password: "NewPassword123!",
    }).success).toBe(true);
  });

  it("rejects a weak password", () => {
    const result = schema.safeParse({
      current_password: "CurrentPassword123!",
      new_password: "short",
      confirm_password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "new_password")).toBe(true);
    }
  });

  it("rejects mismatched passwords", () => {
    const result = schema.safeParse({
      current_password: "CurrentPassword123!",
      new_password: "NewPassword123!",
      confirm_password: "DifferentPassword123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "confirm_password")).toBe(true);
    }
  });
});
