import { LookupPrompt, ReasonPrompt } from "@/components/reason-prompt.js";
import { describe, expect, it, vi } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationTable } from "@vantion/ui/admin/organization-table";

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
   * The gate this whole surface rests on: a read that has not been explained
   * does not happen. effect-form does the refusing, which is why the assertion
   * is that `onSubmit` was never called rather than that a button was disabled
   * — a disabled button is one way to refuse and not the only one.
   */
  it("will not read anything until a reason is given", async () => {
    const onSubmit = vi.fn();

    render(
      <ReasonPrompt
        title="Organizations"
        description="Recorded."
        busy={false}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/A reason is needed/)).toBeInTheDocument();
  });

  it("passes the reason on once it has one", async () => {
    const onSubmit = vi.fn();

    render(
      <ReasonPrompt
        title="Organizations"
        description="Recorded."
        busy={false}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(await screen.findByLabelText("Why are you looking?"), "SUP-1024");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith("SUP-1024"));
  });

  /**
   * The lookup asks for the address as well, and it is just as required: a
   * reason with nobody to look up would be a recorded read of nothing.
   */
  it("will not search without the address being searched for", async () => {
    const onSubmit = vi.fn();

    render(
      <LookupPrompt
        title="Find a person"
        description="Recorded."
        busy={false}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(await screen.findByLabelText("Why are you looking?"), "SUP-1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Enter the address to look up/)).toBeInTheDocument();
  });

  it("says that what is typed is kept", async () => {
    render(
      <ReasonPrompt
        title="Organizations"
        description="Recorded."
        busy={false}
        onSubmit={() => {}}
      />,
    );

    expect(await screen.findByText(/Recorded against your name/)).toBeInTheDocument();
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
