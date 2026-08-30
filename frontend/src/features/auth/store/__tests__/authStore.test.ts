import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi, type AuthResponse } from "../../api/auth.api";
import { useAuthStore } from "../authStore";

const response: AuthResponse = {
  user: {
    id: 7,
    username: "student",
    email: "student@example.com",
    full_name: "Test Student",
    avatar: null,
    is_online: true,
  },
  access: "rotated-access-token",
  refresh: "rotated-refresh-token",
};

describe("auth store password rotation", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: response.user,
      isLoading: false,
      isInitialized: true,
      error: null,
      isAuthenticated: true,
    });
    vi.restoreAllMocks();
  });

  it("stores the fresh token pair returned by the password-change endpoint", async () => {
    vi.spyOn(authApi, "changePassword").mockResolvedValue(response);

    const changed = await useAuthStore.getState().changePassword({
      current_password: "CurrentPassword123!",
      new_password: "NewPassword123!",
      confirm_password: "NewPassword123!",
    });

    expect(changed).toBe(true);
    expect(localStorage.getItem("access_token")).toBe("rotated-access-token");
    expect(localStorage.getItem("refresh_token")).toBe("rotated-refresh-token");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
