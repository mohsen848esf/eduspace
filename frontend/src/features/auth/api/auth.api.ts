import client from "../../../lib/api/client";
import type { LoginInput, RegisterPayload } from "../schemas/auth.schema";

export interface UserOrg {
  id: number;
  name: string;
  slug: string;
  role: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  avatar: string | null;
  is_online: boolean;
  organizations?: UserOrg[];
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export interface OrgContext {
  organization: {
    id: number;
    name: string;
    slug: string;
  } | null;
  role: string | null;
  permissions: string[];
}

export interface OrganizationDetail {
  id: number;
  name: string;
  slug: string;
  type: string;
  is_active: boolean;
  logo: string | null;
  created_at: string;
}

export interface OrgMember {
  id: number;
  user: number;
  user_details: User;
  role: number | null;
  role_name: string | null;
  is_active: boolean;
  contract_type: string;
  joined_at: string;
  expires_at: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string;
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

  updateProfile: async (data: FormData | Partial<User>): Promise<User> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.patch("/auth/me/", data, { headers });
    return res.data;
  },

  logout: async (): Promise<void> => {
    const refresh = localStorage.getItem("refresh_token");
    await client.post("/auth/logout/", { refresh });
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },

  getOrgContext: async (): Promise<OrgContext> => {
    const res = await client.get("/auth/org-context/");
    return res.data;
  },

  getOrganizations: async (): Promise<OrganizationDetail[]> => {
    const res = await client.get("/auth/organizations/");
    return res.data;
  },

  updateOrganization: async (id: number, data: FormData | Partial<OrganizationDetail>): Promise<OrganizationDetail> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.patch(`/auth/organizations/${id}/`, data, { headers });
    return res.data;
  },

  getMembers: async (): Promise<OrgMember[]> => {
    const res = await client.get("/auth/org-members/");
    return res.data;
  },

  inviteMember: async (data: { username?: string; email?: string; role: number | null; contract_type: string; expires_at?: string | null }): Promise<OrgMember> => {
    const res = await client.post("/auth/org-members/", data);
    return res.data;
  },

  updateMember: async (id: number, data: Partial<OrgMember>): Promise<OrgMember> => {
    const res = await client.patch(`/auth/org-members/${id}/`, data);
    return res.data;
  },

  removeMember: async (id: number): Promise<void> => {
    await client.delete(`/auth/org-members/${id}/`);
  },

  getRoles: async (): Promise<Role[]> => {
    const res = await client.get("/auth/roles/");
    return res.data;
  },

  globalSearch: async (q: string): Promise<GlobalSearchResult> => {
    const res = await client.get("/auth/search/global/", { params: { q } });
    return res.data;
  },
};

export interface GlobalSearchResult {
  students: Array<{ id: number; username: string; full_name: string; role: string }>;
  teachers: Array<{ id: number; username: string; full_name: string; role: string }>;
  courses: Array<{ id: number; name: string; code: string }>;
  classes: Array<{ id: number; name: string; course_name: string }>;
  sessions: Array<{ id: number; title: string; status: string; room_code: string | null }>;
  assessments: Array<{ id: number; title: string; is_published: boolean }>;
  invoices: Array<{ id: number; invoice_number: string; amount: string; student_name: string; status: string }>;
}
