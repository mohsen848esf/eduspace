import axios from "axios";

const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith("/") ? `${envUrl}api` : `${envUrl}/api`;
  }
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  if (window.location.port === "5173") {
    return `${protocol}//${hostname}:8000/api`;
  }
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return "http://localhost:8000/api";
  }
  return `${origin}/api`;
};

export const getMediaUrl = (path?: string | null): string => {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  const apiBase = getApiUrl();
  const hostBase = apiBase.replace(/\/api\/?$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${hostBase}${cleanPath}`;
};

const client = axios.create({
  baseURL: getApiUrl(),
  headers: { "Content-Type": "application/json" },
});

// Add the token and only a real, selected organization slug to requests.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const hasValidatedOrg = localStorage.getItem("active_org_slug_validated") === "true";
  const orgSlug = hasValidatedOrg ? localStorage.getItem("active_org_slug")?.trim() : undefined;
  const invalidOrgSlug = !orgSlug || ["null", "undefined", "no organization"].includes(orgSlug.toLowerCase());
  if (orgSlug) {
    if (!invalidOrgSlug) {
      config.headers["X-Organization-Slug"] = orgSlug;
    } else {
      delete config.headers["X-Organization-Slug"];
    }
  } else {
    delete config.headers["X-Organization-Slug"];
  }

  return config;
});

interface QueueItem {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle token expiry
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    // Lobby status polling is authenticated via X-Guest-Access-Token, not JWT.
    // Skip the refresh/redirect flow for these requests so the useLobbyWaiting
    // hook can handle auth errors gracefully without forcing a login redirect.
    const isLobbyPoll = original?.url?.includes("/lobby/status/");
    const isGuestPermissionPoll = original?.url?.endsWith("/permissions/") &&
      original?.headers?.["X-Guest-Access-Token"];
    if (error.response?.status === 401 && !original._retry && !isLobbyPoll && !isGuestPermissionPoll) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      original._retry = true;
      isRefreshing = true;

      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${getApiUrl()}/auth/token/refresh/`,
            { refresh },
          );
          localStorage.setItem("access_token", data.access);
          if (data.refresh) {
            localStorage.setItem("refresh_token", data.refresh);
          }
          original.headers.Authorization = `Bearer ${data.access}`;
          processQueue(null, data.access);
          return client(original);
        } catch (err) {
          processQueue(err, null);
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
    }
    return Promise.reject(error);
  },
);

export default client;
