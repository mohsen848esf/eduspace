import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../Card";

describe("Card compound component", () => {
  it("renders card structure with header, content, and footer", () => {
    render(
      <Card>
        <CardHeader action={<button>Action</button>}>
          <CardTitle>Metric Card</CardTitle>
          <CardDescription>Description info</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
        <CardFooter>Footer info</CardFooter>
      </Card>
    );

    expect(screen.getByText("Metric Card")).toBeInTheDocument();
    expect(screen.getByText("Description info")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Footer info")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
  });
});
