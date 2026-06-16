import client from "../../../lib/api/client";

export const reportsApi = {
  exportReport: async (type: "grades" | "financials" | "attendance"): Promise<void> => {
    const response = await client.get(`/analytics/reports/export/?type=${type}`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${type}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  requestGDPRData: async (): Promise<void> => {
    const response = await client.post("/auth/privacy/request-export/");
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `gdpr_personal_data_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteAccount: async (password: string): Promise<{ detail: string }> => {
    const response = await client.post("/auth/privacy/delete-account/", { password });
    return response.data;
  },
};
