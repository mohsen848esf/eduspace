import client from "../../../lib/api/client";

export interface OrganizationQuota {
  id: number;
  max_students: number;
  max_teachers: number;
  max_courses: number;
  max_storage_gb: number;
  max_active_sessions: number;
  max_recording_minutes: number;
}

export interface OrganizationUsage {
  id: number;
  students_count: number;
  teachers_count: number;
  courses_count: number;
  storage_used_gb: number;
  active_sessions_count: number;
  recording_minutes_used: number;
}

export interface OrganizationAdmin {
  id: number;
  name: string;
  slug: string;
  type: string;
  owner: number;
  owner_username: string;
  is_active: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string;
  logo: string | null;
  created_at: string;
  quota?: Partial<OrganizationQuota>;
  usage?: OrganizationUsage;
}

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface OperatorAuditLog {
  id: number;
  operator: number;
  operator_username: string;
  action: string;
  organization: number | null;
  organization_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface DashboardMetrics {
  organizations: {
    total: number;
    suspended: number;
    active: number;
  };
  users: {
    total: number;
  };
  sessions: {
    live: number;
  };
  storage: {
    used_gb: number;
  };
  recordings: {
    minutes_used: number;
  };
  celery_backlog: Record<string, number>;
}

export const sysAdminApi = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const res = await client.get("/sys-admin/dashboard/metrics/");
    return res.data;
  },

  getOrganizations: async (params?: { search?: string; ordering?: string }): Promise<OrganizationAdmin[]> => {
    const res = await client.get("/sys-admin/organizations/", { params });
    return res.data;
  },

  getOrganization: async (id: number): Promise<OrganizationAdmin> => {
    const res = await client.get(`/sys-admin/organizations/${id}/`);
    return res.data;
  },

  updateOrganization: async (id: number, data: Partial<OrganizationAdmin>): Promise<OrganizationAdmin> => {
    const res = await client.patch(`/sys-admin/organizations/${id}/`, data);
    return res.data;
  },

  suspendOrganization: async (id: number, reason: string): Promise<OrganizationAdmin> => {
    const res = await client.post(`/sys-admin/organizations/${id}/suspend/`, { reason });
    return res.data;
  },

  restoreOrganization: async (id: number): Promise<OrganizationAdmin> => {
    const res = await client.post(`/sys-admin/organizations/${id}/restore/`);
    return res.data;
  },

  getConfigs: async (params?: { search?: string }): Promise<SystemConfig[]> => {
    const res = await client.get("/sys-admin/configs/", { params });
    return res.data;
  },

  createConfig: async (data: { key: string; value: string; description?: string }): Promise<SystemConfig> => {
    const res = await client.post("/sys-admin/configs/", data);
    return res.data;
  },

  updateConfig: async (id: number, data: { value: string; description?: string }): Promise<SystemConfig> => {
    const res = await client.patch(`/sys-admin/configs/${id}/`, data);
    return res.data;
  },

  deleteConfig: async (id: number): Promise<void> => {
    await client.delete(`/sys-admin/configs/${id}/`);
  },

  getAuditLogs: async (params?: { search?: string }): Promise<OperatorAuditLog[]> => {
    const res = await client.get("/sys-admin/audit-logs/", { params });
    return res.data;
  },
};
