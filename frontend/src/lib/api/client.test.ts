import { afterEach, describe, expect, it } from "vitest";
import type { AxiosResponse } from "axios";

import client from "./client";

describe("API organization header", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("omits the organization header when there is no selected organization", async () => {
    localStorage.setItem("active_org_slug", "no organization");
    client.defaults.adapter = async (config) => ({
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    } as AxiosResponse);

    const response = await client.get("/auth/me/");

    expect(response.config.headers?.["X-Organization-Slug"]).toBeUndefined();
  });
});
