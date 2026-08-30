import { beforeEach, describe, expect, it, vi } from "vitest";

import { authApi, type OrgContext, type UserOrg } from "../../api/auth.api";
import {
  normalizeOrganizationSlug,
  selectOrganizationSlug,
  useOrgContextStore,
} from "../orgContextStore";

vi.mock("../../api/auth.api", () => ({
  authApi: {
    getOrgContext: vi.fn(),
  },
}));

const organizations: UserOrg[] = [
  { id: 1, name: "First", slug: "first", role: "Teacher" },
  { id: 2, name: "Second", slug: "second", role: "Student" },
];

const contextFor = (organization: UserOrg | null): OrgContext => ({
  organization: organization
    ? { id: organization.id, name: organization.name, slug: organization.slug }
    : null,
  role: organization?.role || null,
  permissions: [],
});

describe("organization context selection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useOrgContextStore.setState({
      orgContext: null,
      isLoading: false,
      isInitialized: false,
      error: null,
      activeSlug: null,
    });
  });

  it("selects the first exposed organization when localStorage is stale", async () => {
    localStorage.setItem("active_org_slug", "deleted-tenant");
    vi.mocked(authApi.getOrgContext).mockResolvedValue(contextFor(organizations[0]));

    await useOrgContextStore.getState().fetchOrgContext(undefined, organizations);

    expect(authApi.getOrgContext).toHaveBeenCalledOnce();
    expect(useOrgContextStore.getState().activeSlug).toBe("first");
    expect(localStorage.getItem("active_org_slug")).toBe("first");
  });

  it("preserves a valid stored organization", async () => {
    localStorage.setItem("active_org_slug", "second");
    useOrgContextStore.setState({ activeSlug: "second" });
    vi.mocked(authApi.getOrgContext).mockResolvedValue(contextFor(organizations[1]));

    await useOrgContextStore.getState().fetchOrgContext(undefined, organizations);

    expect(useOrgContextStore.getState().activeSlug).toBe("second");
    expect(localStorage.getItem("active_org_slug")).toBe("second");
  });

  it("does not call the tenant context endpoint for a user without memberships", async () => {
    localStorage.setItem("active_org_slug", "stale-tenant");

    await useOrgContextStore.getState().fetchOrgContext(undefined, []);

    expect(authApi.getOrgContext).not.toHaveBeenCalled();
    expect(useOrgContextStore.getState().orgContext).toBeNull();
    expect(useOrgContextStore.getState().activeSlug).toBeNull();
    expect(localStorage.getItem("active_org_slug")).toBeNull();
    expect(useOrgContextStore.getState().isInitialized).toBe(true);
  });

  it("normalizes the old sentinel instead of treating it as a tenant", () => {
    expect(normalizeOrganizationSlug("no organization")).toBeNull();
    expect(normalizeOrganizationSlug("null")).toBeNull();
    expect(selectOrganizationSlug(organizations, "no organization")).toBe("first");
  });
});
