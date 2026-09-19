import { describe, expect, it } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { OrganizationTable } from "@vantion/ui/admin/organization-table";
import { ReasonPrompt } from "@vantion/ui/admin/reason-prompt";

const rows = [
  {
    id: "org_a",
    name: "Acme",
    slug: "acme",
    members: 4,
    plan: "pro",
    createdAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("the reason prompt", () => {
  /**
   * The control, as a component. A reason box beside the data rather than in
   * front of it is one nobody fills in, so the button is unusable until
   * something is typed.
   */
  it("will not continue until a reason is given", () => {
    render(
      <ReasonPrompt
        title="Organizations"
        description="Recorded."
        busy={false}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("says that what is typed is kept", () => {
    render(
      <ReasonPrompt
        title="Organizations"
        description="Recorded."
        busy={false}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByText(/Recorded against your name/)).toBeInTheDocument();
  });
});

describe("the organization table", () => {
  it("shows the counts a support engineer needs", () => {
    render(<OrganizationTable organizations={rows} onOpen={() => {}} />);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("says so plainly when there are none", () => {
    render(<OrganizationTable organizations={[]} onOpen={() => {}} />);

    expect(screen.getByText("No organizations")).toBeInTheDocument();
  });
});
