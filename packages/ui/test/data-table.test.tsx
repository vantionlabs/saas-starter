import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "@vantion/ui/ui/data-table";
import type { DataColumn } from "@vantion/ui/ui/data-table";
import { Users } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type Person = { readonly name: string; readonly email: string; };

const columns: Array<DataColumn<Person>> = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
];

const people = (count: number): Array<Person> =>
  Array.from({ length: count }, (_, i) => ({
    name: `Person ${String(i).padStart(2, "0")}`,
    email: `person${i}@example.test`,
  }));

const empty = { icon: Users, title: "Nobody yet", description: "Nobody here." };

describe("DataTable", () => {
  /**
   * The property that matters most on these screens: the rows are in the
   * document the server sends. A table that needed JavaScript to show its first
   * page would undo every read that was moved to a loader.
   */
  it("renders its rows in server markup", () => {
    const html = renderToStaticMarkup(
      <DataTable rows={people(3)} columns={columns} empty={empty} />,
    );

    expect(html).toContain("Person 00");
    expect(html).toContain("person2@example.test");
  });

  it("shows the empty state when there is nothing at all", () => {
    render(<DataTable rows={[]} columns={columns} empty={empty} />);

    expect(screen.getByText("Nobody yet")).toBeInTheDocument();
  });

  it("filters to what was typed", async () => {
    render(
      <DataTable rows={people(5)} columns={columns} empty={empty} filterPlaceholder="Filter" />,
    );

    await userEvent.type(screen.getByLabelText("Filter"), "Person 03");

    expect(screen.getByText("Person 03")).toBeInTheDocument();
    expect(screen.queryByText("Person 01")).not.toBeInTheDocument();
  });

  /**
   * Finding nothing is not the same as having nothing: the empty state would
   * take the filter box away with it and leave somebody no way to undo the
   * search that emptied their screen.
   */
  it("keeps the filter box when a search matches nothing", async () => {
    render(
      <DataTable rows={people(5)} columns={columns} empty={empty} filterPlaceholder="Filter" />,
    );

    await userEvent.type(screen.getByLabelText("Filter"), "nobody at all");

    expect(screen.getByText("Nothing matches that.")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter")).toBeInTheDocument();
    expect(screen.queryByText("Nobody yet")).not.toBeInTheDocument();
  });

  it("pages rather than rendering everything", async () => {
    render(<DataTable rows={people(30)} columns={columns} empty={empty} pageSize={10} />);

    expect(screen.getByText("Person 00")).toBeInTheDocument();
    expect(screen.queryByText("Person 20")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Person 10")).toBeInTheDocument();
    expect(screen.queryByText("Person 00")).not.toBeInTheDocument();
  });

  it("sorts when a header is pressed", async () => {
    render(<DataTable rows={people(3).reverse()} columns={columns} empty={empty} />);

    await userEvent.click(screen.getByRole("button", { name: /Name/ }));

    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells[0]).toBe("Person 00");
  });
});
