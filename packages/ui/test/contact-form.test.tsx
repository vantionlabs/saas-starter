import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "@vantion/ui/contact/contact-form";
import { describe, expect, it, vi } from "vitest";

describe("ContactForm", () => {
  /**
   * The button used to be disabled until both fields had content. It is not any
   * more, and the reason is server rendering: "disabled" then meant two
   * different things — your input is incomplete, and React has not attached
   * yet — and the second one hid a bug where everything typed before hydration
   * was silently discarded. Incompleteness is said out loud now; only
   * hydration and a create in flight disable the control.
   */
  it("says what is missing rather than going quiet", async () => {
    const onCreate = vi.fn();
    render(<ContactForm onCreate={onCreate} pending={false} />);

    await userEvent.type(screen.getByLabelText("Name"), "Only A Name");
    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Both a name and an email address are needed.",
    );
  });

  /**
   * Uncontrolled, which is what makes the form survive hydration: the DOM holds
   * what was typed, so text entered before React attached is still there to
   * submit. A controlled input would have thrown it away.
   */
  it("reads its values from the DOM rather than from React state", async () => {
    const onCreate = vi.fn();
    render(<ContactForm onCreate={onCreate} pending={false} />);

    const name = screen.getByLabelText<HTMLInputElement>("Name");
    const email = screen.getByLabelText<HTMLInputElement>("Email");

    // Set directly, the way a browser does before any handler exists.
    name.value = "Typed Early";
    email.value = "early@example.com";

    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));

    expect(onCreate).toHaveBeenCalledWith({
      email: "early@example.com",
      fullName: "Typed Early",
    });
  });

  it("trims input and clears the fields after submitting", async () => {
    const onCreate = vi.fn();
    render(<ContactForm onCreate={onCreate} pending={false} />);

    await userEvent.type(screen.getByLabelText("Name"), "  A Contact  ");
    await userEvent.type(screen.getByLabelText("Email"), "  contact@example.com  ");
    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));

    expect(onCreate).toHaveBeenCalledWith({ email: "contact@example.com", fullName: "A Contact" });
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("cannot be submitted twice while a create is in flight", () => {
    render(<ContactForm onCreate={vi.fn()} pending />);

    expect(screen.getByRole("button", { name: /add contact/i })).toBeDisabled();
  });
});
