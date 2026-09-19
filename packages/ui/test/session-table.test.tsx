import { render, screen } from "@testing-library/react";
import { SessionTable } from "@vantion/ui/settings/session-table";
import { describe, expect, it } from "vitest";

const session = (over: Partial<Parameters<typeof SessionTable>[0]["sessions"][number]> = {}) => ({
  id: "s1",
  createdAt: "2026-09-01T10:00:00.000Z",
  expiresAt: "2026-10-01T10:00:00.000Z",
  ipAddress: "203.0.113.4",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36",
  ...over,
});

describe("SessionTable", () => {
  /**
   * The property worth a test: a session row carries a token, and this table
   * must never be the thing that renders one. Asserting on the absence is the
   * only way that stays true when somebody widens the row type later.
   */
  it("shows nothing that could be used as a credential", () => {
    render(<SessionTable sessions={[session()]} />);

    expect(document.body.textContent).not.toContain("Mozilla");
    expect(screen.getByText("203.0.113.4")).toBeInTheDocument();
  });

  it("names the device in a way somebody can recognise", () => {
    render(<SessionTable sessions={[session()]} />);

    expect(screen.getByText("Chrome on Macintosh")).toBeInTheDocument();
  });

  /** A session from something unrecognised is still a session worth showing. */
  it("says so rather than going blank for an unknown agent", () => {
    render(<SessionTable sessions={[session({ userAgent: null })]} />);

    expect(screen.getByText("Unknown device")).toBeInTheDocument();
  });

  it("has an empty state", () => {
    render(<SessionTable sessions={[]} />);

    expect(screen.getByText("No other sessions")).toBeInTheDocument();
  });
});
