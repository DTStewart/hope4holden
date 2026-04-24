import { useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  Row,
} from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportToCsv } from "@/lib/exportCsv";

export interface AdminDataTableProps<T extends object> {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  /** Field keys to search across. Defaults to all string-valued columns of T. */
  searchKeys?: (keyof T)[];
  initialSort?: { id: string; desc: boolean };
  /** When set, sort + filter state are persisted into URL query params namespaced by this key. */
  urlStateKey?: string;
  emptyMessage?: string;
  /** Set to false to hide the Export CSV button (default: true). */
  enableExport?: boolean;
  /** Optional CSV filename override (without extension). Defaults to urlStateKey || "export". */
  exportFilename?: string;
  /** Optional class for outer wrapper. */
  className?: string;
}

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function csvCellFromRow<T>(row: Row<T>, col: ColumnDef<T, any>): string {
  // Prefer accessorKey-based value; fall back to a rendered string of the cell.
  const accKey = (col as any).accessorKey as string | undefined;
  if (accKey) {
    const v = row.getValue(accKey);
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }
  // Last-resort: stringify the raw row id
  return "";
}

function headerLabel<T>(col: ColumnDef<T, any>): string {
  const h = (col as any).header;
  if (typeof h === "string") return h;
  // For function/element headers, fall back to id or accessorKey
  return (col as any).id || (col as any).accessorKey || "";
}

export function AdminDataTable<T extends object>({
  data,
  columns,
  searchPlaceholder = "Search…",
  searchKeys,
  initialSort,
  urlStateKey,
  emptyMessage = "No records found.",
  enableExport = true,
  exportFilename,
  className,
}: AdminDataTableProps<T>) {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial state from URL if urlStateKey is provided
  const urlSortKey = urlStateKey ? `${urlStateKey}_sort` : null;
  const urlQKey = urlStateKey ? `${urlStateKey}_q` : null;

  const initialSortingFromUrl = useMemo<SortingState>(() => {
    if (!urlSortKey) return initialSort ? [initialSort] : [];
    const raw = searchParams.get(urlSortKey);
    if (!raw) return initialSort ? [initialSort] : [];
    // format: "id:desc" or "id:asc"
    const [id, dir] = raw.split(":");
    if (!id) return initialSort ? [initialSort] : [];
    return [{ id, desc: dir === "desc" }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialQFromUrl = useMemo(() => {
    if (!urlQKey) return "";
    return searchParams.get(urlQKey) || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sorting, setSorting] = useState<SortingState>(initialSortingFromUrl);
  const [search, setSearch] = useState(initialQFromUrl);
  const debouncedSearch = useDebounced(search, 300);

  // Persist to URL when state changes
  useEffect(() => {
    if (!urlStateKey) return;
    const next = new URLSearchParams(searchParams);
    if (sorting[0]) {
      next.set(`${urlStateKey}_sort`, `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
    } else {
      next.delete(`${urlStateKey}_sort`);
    }
    if (debouncedSearch) {
      next.set(`${urlStateKey}_q`, debouncedSearch);
    } else {
      next.delete(`${urlStateKey}_q`);
    }
    // Only update if changed
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, debouncedSearch, urlStateKey]);

  // Build globalFilter fn that respects searchKeys
  const globalFilterFn = useCallback(
    (row: Row<T>, _columnId: string, filterValue: string) => {
      if (!filterValue) return true;
      const needle = String(filterValue).toLowerCase();
      const keys: string[] =
        (searchKeys as string[] | undefined) ||
        Object.keys(row.original as object).filter(
          (k) => typeof (row.original as any)[k] === "string"
        );
      for (const k of keys) {
        const v = (row.original as any)[k];
        if (v == null) continue;
        if (typeof v === "string" || typeof v === "number") {
          if (String(v).toLowerCase().includes(needle)) return true;
        } else if (typeof v === "object") {
          try {
            if (JSON.stringify(v).toLowerCase().includes(needle)) return true;
          } catch {
            /* ignore */
          }
        }
      }
      return false;
    },
    [searchKeys]
  );

  const table = useReactTable<T>({
    data,
    columns,
    state: { sorting, globalFilter: debouncedSearch },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredRows = table.getRowModel().rows;
  const totalRowCount = data.length;
  const visibleRowCount = filteredRows.length;

  const handleExport = () => {
    const visibleColumns = table
      .getVisibleLeafColumns()
      .filter((c) => c.id !== "actions" && c.id !== "_actions");
    const headers = visibleColumns.map((c) =>
      headerLabel(c.columnDef as ColumnDef<T, any>)
    );
    const rows = filteredRows.map((row) =>
      visibleColumns.map((c) => csvCellFromRow(row, c.columnDef as ColumnDef<T, any>))
    );
    const date = new Date().toISOString().slice(0, 10);
    const base = exportFilename || urlStateKey || "export";
    exportToCsv(`${base}-${date}.csv`, headers, rows);
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-muted-foreground">
          Showing {visibleRowCount} of {totalRowCount}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full sm:w-[240px]"
          />
          {enableExport && (
            <Button size="sm" variant="outline" onClick={handleExport} disabled={visibleRowCount === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {visibleRowCount === 0 ? (
        <p className="text-muted-foreground text-center py-6">{emptyMessage}</p>
      ) : isMobile ? (
        // Mobile: stacked key/value cards
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const cells = row.getVisibleCells();
            const actionsCell = cells.find(
              (c) => c.column.id === "actions" || c.column.id === "_actions"
            );
            const dataCells = cells.filter((c) => c !== actionsCell);
            return (
              <div
                key={row.id}
                className="rounded-md border border-border bg-card p-3 text-sm space-y-1.5"
              >
                {dataCells.map((cell) => {
                  const label = headerLabel(cell.column.columnDef as ColumnDef<T, any>);
                  const rendered = flexRender(cell.column.columnDef.cell, cell.getContext());
                  return (
                    <div key={cell.id} className="flex justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">
                        {label}
                      </span>
                      <span className="text-right min-w-0 break-words">{rendered as ReactNode}</span>
                    </div>
                  );
                })}
                {actionsCell && (
                  <div className="pt-2 border-t border-border/50 flex justify-end gap-1">
                    {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext()) as ReactNode}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortDir === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
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
        </div>
      )}
    </div>
  );
}

export default AdminDataTable;
