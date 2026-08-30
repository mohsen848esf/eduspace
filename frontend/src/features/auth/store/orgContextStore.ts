import { create } from "zustand";
import { authApi, type OrgContext, type UserOrg } from "../api/auth.api";
import { getApiErrorMessage } from "@/lib/api/errors";

const INVALID_ORGANIZATION_SLUGS = new Set([
  "",
  "null",
  "undefined",
  "no organization",
]);
const VALIDATED_ORGANIZATION_STORAGE_KEY = "active_org_slug_validated";

export function normalizeOrganizationSlug(slug?: string | null): string | null {
  const normalized = slug?.trim() || null;
  return normalized && !INVALID_ORGANIZATION_SLUGS.has(normalized.toLowerCase())
    ? normalized
    : null;
}

export function selectOrganizationSlug(
  organizations: UserOrg[],
  storedSlug?: string | null,
  requestedSlug?: string | null,
): string | null {
  if (organizations.length === 0) return null;

  const availableSlugs = new Set(
    organizations
      .map((organization) => normalizeOrganizationSlug(organization.slug))
      .filter((slug): slug is string => Boolean(slug)),
  );
  const preferredSlug = normalizeOrganizationSlug(requestedSlug) || normalizeOrganizationSlug(storedSlug);

  return preferredSlug && availableSlugs.has(preferredSlug)
    ? preferredSlug
    : organizations.map((organization) => normalizeOrganizationSlug(organization.slug)).find((slug): slug is string => Boolean(slug)) || null;
}

interface OrgContextState {
  orgContext: OrgContext | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  activeSlug: string | null;

  fetchOrgContext: (slug?: string, organizations?: UserOrg[]) => Promise<void>;
  setActiveSlug: (slug: string) => void;
  clearOrgContext: () => void;
}

export const useOrgContextStore = create<OrgContextState>((set, get) => ({
  orgContext: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  activeSlug: normalizeOrganizationSlug(localStorage.getItem("active_org_slug")),

  fetchOrgContext: async (slug, organizations) => {
    const targetSlug = organizations
      ? selectOrganizationSlug(organizations, get().activeSlug, slug)
      : normalizeOrganizationSlug(slug) || get().activeSlug;

    set({
      orgContext: null,
      isInitialized: false,
      isLoading: Boolean(targetSlug),
      error: null,
      activeSlug: targetSlug,
    });

    if (!targetSlug) {
      localStorage.removeItem("active_org_slug");
      localStorage.removeItem(VALIDATED_ORGANIZATION_STORAGE_KEY);
      set({ isInitialized: true, isLoading: false });
      return;
    }

    localStorage.setItem("active_org_slug", targetSlug);
    localStorage.setItem(VALIDATED_ORGANIZATION_STORAGE_KEY, "true");
    try {
      const context = await authApi.getOrgContext();
      const resolvedSlug = normalizeOrganizationSlug(context.organization?.slug);
      if (resolvedSlug) {
        localStorage.setItem("active_org_slug", resolvedSlug);
        localStorage.setItem(VALIDATED_ORGANIZATION_STORAGE_KEY, "true");
      } else {
        localStorage.removeItem("active_org_slug");
        localStorage.removeItem(VALIDATED_ORGANIZATION_STORAGE_KEY);
      }
      set({
        orgContext: context,
        isInitialized: true,
        isLoading: false,
        activeSlug: resolvedSlug,
      });
    } catch (error: unknown) {
      localStorage.removeItem("active_org_slug");
      localStorage.removeItem(VALIDATED_ORGANIZATION_STORAGE_KEY);
      set({
        orgContext: null,
        error: getApiErrorMessage(error, "Failed to fetch organization context"),
        isLoading: false,
        isInitialized: true,
        activeSlug: null,
      });
    }
  },

  setActiveSlug: (slug) => {
    const nextSlug = normalizeOrganizationSlug(slug);
    set({
      activeSlug: nextSlug,
      orgContext: null,
      isInitialized: false,
      error: null,
    });
    if (nextSlug) {
      localStorage.setItem("active_org_slug", nextSlug);
      localStorage.setItem(VALIDATED_ORGANIZATION_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem("active_org_slug");
      localStorage.removeItem(VALIDATED_ORGANIZATION_STORAGE_KEY);
    }
  },

  clearOrgContext: () => {
    localStorage.removeItem("active_org_slug");
    localStorage.removeItem(VALIDATED_ORGANIZATION_STORAGE_KEY);
    set({ orgContext: null, activeSlug: null, isInitialized: false, error: null });
  },
}));
