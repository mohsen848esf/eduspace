import axios from "axios";

const getApiUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith("/") ? `${envUrl}api` : `${envUrl}/api`;
  }
  const origin = window.location.origin;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return "http://localhost:8000/api";
  }
  return `${origin}/api`;
};

const client = axios.create({
  baseURL: getApiUrl(),
  headers: { "Content-Type": "application/json" },
});

// Add token and organization slug to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const orgSlug = localStorage.getItem("active_org_slug") || "default-academy";
  if (orgSlug) {
    config.headers["X-Organization-Slug"] = orgSlug;
  }

  return config;
});

// Handle token expiry
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${getApiUrl()}/auth/token/refresh/`,
            { refresh },
          );
          localStorage.setItem("access_token", data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return client(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

export default client;
