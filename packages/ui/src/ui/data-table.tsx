import type { ColumnDef } from "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { EmptyState } from "../app/empty-state.js";
import { Button } from "./button.js";
import { Input } from "./input.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

/**
 * One table, for every list long enough to need finding something in it.
 *
 * TanStack Table is headless, so the markup below is still this repository's
 * own `Table` primitives — what it brings is the part every list was otherwise
 * going to reimplement badly: sorting, filtering and paging over rows.
 *
 * **Paged, not virtualised**, and that is the decision worth explaining.
 * Virtualising renders only the rows in the viewport, which means the server
 * renders a handful and the rest appear when JavaScript runs — exactly the
 * thing every read on these screens was moved to the server to avoid. A page of
 * rows is completely server-rendered, readable without JavaScript, and the
 * pager is a control like any other. A list long enough that paging hurts is a
 * list that wants a server-side query, not a taller window.
 *
 * The filter input is **uncontrolled**, for the reason every input on a
 * server-rendered page is: the table is in the document before React attaches,
 * and a controlled input discards anything typed in that window. Here the text
 * stays in the DOM and the first keystroke after hydration applies it — nothing
 * is lost, and the control never looks dead.
 */
/**
 * A column of a `DataTable`. Exported so callers can type their definitions.
 *
 * **v8, not v9.** v9 is days old and its option shapes are documented only in
 * its type definitions; everything anybody finds when they reach for this — the
 * docs, every example, every answer — is v8. A template's job is to be legible
 * to whoever clones it, and shipping an API surface that has to be
 * reverse-engineered is the opposite of that. Worth revisiting once v9 has
 * documentation, which is a version bump rather than a rewrite: the markup
 * below is this repository's own primitives either way.
 */
export type DataColumn<Row extends RowData> = ColumnDef<Row>;

export const DataTable = <Row extends RowData>(props: {
  readonly rows: ReadonlyArray<Row>;
  readonly columns: ReadonlyArray<DataColumn<Row>>;
  /** Shown instead of the table when there is nothing at all. */
  readonly empty: {
    readonly icon: LucideIcon;
    readonly title: string;
    readonly description: string;
  };
  /** Placeholder for the filter box. Omitted means no filtering. */
  readonly filterPlaceholder?: string | undefined;
  /** Rows per page. Above this, the pager appears. */
  readonly pageSize?: number | undefined;
}) => {
  const [filter, setFilter] = React.useState("");
  /**
   * Pagination is held here rather than read back off the table, because v9's
   * `ReactTable` deliberately does not expose its store — state is either
   * controlled by the caller or selected. Controlling it is the simpler of the
   * two when the only thing on screen that needs it is "page 2 of 4".
   */
  const [pageIndex, setPageIndex] = React.useState(0);
  const pageSize = props.pageSize ?? 25;

  const table = useReactTable({
    data: props.rows as Array<Row>,
    columns: props.columns as Array<ColumnDef<Row>>,
    state: { globalFilter: filter, pagination: { pageIndex, pageSize } },
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  /**
   * The empty state is for having nothing, not for finding nothing. A filter
   * that matches no rows needs to say so *and* leave the box in place, or
   * somebody is left with no way to undo the search that emptied the screen.
   */
  if (props.rows.length === 0) {
    return (
      <EmptyState
        icon={props.empty.icon}
        title={props.empty.title}
        description={props.empty.description}
      />
    );
  }

  const paged = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col gap-3">
      {props.filterPlaceholder !== undefined && (
        <Input
          type="search"
          aria-label={props.filterPlaceholder}
          placeholder={props.filterPlaceholder}
          className="max-w-xs"
          onChange={(event) => setFilter(event.target.value)}
        />
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const direction = header.column.getIsSorted();
                const Icon = direction === "asc"
                  ? ArrowUp
                  : direction === "desc"
                  ? ArrowDown
                  : ChevronsUpDown;

                // No `size`: column sizing is a whole feature in v9, and
                // paying for it to set a width a class already sets is the kind
                // of bundle nobody notices growing.
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : sortable
                      ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Icon className="size-3 opacity-60" aria-hidden />
                        </button>
                      )
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {paged.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {paged.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nothing matches that.
        </p>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Page {pageIndex + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => setPageIndex((page) => Math.min(pageCount - 1, page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
