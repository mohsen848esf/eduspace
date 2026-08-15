import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

describe("StatCard component", () => {
  it("renders metric title, value, and trend indicator", () => {
    render(
      <StatCard
        title="Total Revenue"
        value="$124,500"
        trend={{ value: "+14.2%", direction: "up", label: "vs last month" }}
      />
    );

    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("$124,500")).toBeInTheDocument();
    expect(screen.getByText("+14.2%")).toBeInTheDocument();
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });
});
