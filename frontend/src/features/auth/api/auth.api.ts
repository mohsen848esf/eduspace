import client from "../../../lib/api/client";
import type { LoginInput, RegisterPayload } from "../schemas/auth.schema";

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  avatar: string | null;
  is_online: boolean;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export const authApi = {
  login: async (data: LoginInput): Promise<AuthResponse> => {
    const res = await client.post("/auth/login/", data);
    return res.data;
  },

  register: async (data: RegisterPayload): Promise<AuthResponse> => {
    const res = await client.post("/auth/register/", data);
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await client.get("/auth/me/");
    return res.data;
  },

  logout: async (): Promise<void> => {
    const refresh = localStorage.getItem("refresh_token");
    await client.post("/auth/logout/", { refresh });
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },
};
