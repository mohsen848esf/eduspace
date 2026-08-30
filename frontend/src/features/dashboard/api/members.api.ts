import client from "@/lib/api/client";
import type { OrgMember, Permission, Role, SimpleUser } from "../types/crm.types";

export const membersApi = {
  // User search for selector
  searchUsers: async (q: string, role?: string): Promise<SimpleUser[]> => {
    const url = `/auth/search/?q=${encodeURIComponent(q)}${role ? `&role=${encodeURIComponent(role)}` : ""}`;
    const res = await client.get(url);
    return res.data;
  },

  // Members CRUD
  getMembers: async (): Promise<OrgMember[]> => {
    const res = await client.get("/auth/org-members/");
    return res.data;
  },
  getMember: async (id: number): Promise<OrgMember> => {
    const res = await client.get(`/auth/org-members/${id}/`);
    return res.data;
  },
  createMember: async (data: {
    username?: string;
    email?: string;
    password?: string;
    full_name?: string;
    role: number | null;
    contract_type?: string;
    expires_at?: string | null;
  }): Promise<OrgMember> => {
    const res = await client.post("/auth/org-members/", data);
    return res.data;
  },
  updateMember: async (id: number, data: Partial<OrgMember>): Promise<OrgMember> => {
    const res = await client.patch(`/auth/org-members/${id}/`, data);
    return res.data;
  },
  deleteMember: async (id: number): Promise<void> => {
    await client.delete(`/auth/org-members/${id}/`);
  },

  // Roles CRUD
  getRoles: async (): Promise<Role[]> => {
    const res = await client.get("/auth/roles/");
    return res.data;
  },
  createRole: async (data: { name: string; description: string; permissions: string[] }): Promise<Role> => {
    const res = await client.post("/auth/roles/", data);
    return res.data;
  },
  updateRole: async (id: number, data: { name?: string; description?: string; permissions?: string[] }): Promise<Role> => {
    const res = await client.patch(`/auth/roles/${id}/`, data);
    return res.data;
  },
  deleteRole: async (id: number): Promise<void> => {
    await client.delete(`/auth/roles/${id}/`);
  },
  getAvailablePermissions: async (): Promise<Permission[]> => {
    const res = await client.get("/auth/roles/permissions/");
    return res.data;
  },
};
