import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { Card } from "@/shared/components/Card";
import { useMediaQuery } from "../lib/useMediaQuery";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { PaginationFooter, type PaginationState } from "./PaginationFooter";
import { SkeletonRows } from "./SkeletonRows";

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /**
   * Card layout (below `md`): `primary` is the card's headline, `secondary`
   * sits opposite it (typically a status pill). Unmarked columns become
   * labelled rows. In the table every column is an ordinary column.
   */
  role?: "primary" | "secondary";
  align?: "left" | "right";
}

interface ResponsiveTableProps<T> {
  /** Accessible name of the table / list. */
  label: string;
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  /** Dims the rows while a refetch (new page, new filter) is in flight. */
  refreshing?: boolean;
  /** Pass `describeError(error)` to show the error state. */
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Shown when there are no rows; defaults to a generic message. */
  empty?: ReactNode;
  /** Content revealed under a row; return null for rows that are not expanded. */
  renderExpanded?: (row: T) => ReactNode;
  pagination?: PaginationState;
}

const ALIGN_CLASS = { left: "text-left", right: "text-right" } as const;

export function ResponsiveTable<T>(props: ResponsiveTableProps<T>) {
  const { loading = false, errorMessage, onRetry, empty, rows, pagination, refreshing = false } = props;
  const isWide = useMediaQuery("(min-width: 768px)");

  function renderBody(): ReactNode {
    if (errorMessage) return <ErrorState message={errorMessage} onRetry={onRetry} />;
    if (loading) return <SkeletonRows />;
    if (rows.length === 0) return empty ?? <EmptyState title="Nothing to show yet" />;
    return isWide ? <TableView {...props} /> : <CardList {...props} />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div aria-busy={refreshing} className={clsx("transition-opacity duration-150", refreshing && "opacity-60")}>
        {renderBody()}
      </div>
      {pagination && !errorMessage && !loading && <PaginationFooter {...pagination} />}
    </Card>
  );
}

function TableView<T>({ label, columns, rows, getRowKey, renderExpanded }: ResponsiveTableProps<T>) {
  return (
    <table aria-label={label} className="w-full text-[13.5px]">
      <thead>
        <tr className="border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          {columns.map((column) => (
            <th key={column.key} scope="col" className={clsx("px-5 py-3 font-semibold", ALIGN_CLASS[column.align ?? "left"])}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.map((row) => {
          const expanded = renderExpanded?.(row);
          return (
            <Fragment key={getRowKey(row)}>
              <tr className="align-top hover:bg-surface-sunken">
                {columns.map((column) => (
                  <td key={column.key} className={clsx("px-5 py-3", ALIGN_CLASS[column.align ?? "left"])}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
              {expanded && (
                <tr className="bg-surface-sunken">
                  <td colSpan={columns.length} className="px-5 py-4">
                    {expanded}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function CardList<T>({ label, columns, rows, getRowKey, renderExpanded }: ResponsiveTableProps<T>) {
  const primary = columns.find((column) => column.role === "primary");
  const secondary = columns.find((column) => column.role === "secondary");
  const details = columns.filter((column) => !column.role);

  return (
    <ul aria-label={label} className="divide-y divide-border-subtle">
      {rows.map((row) => {
        const expanded = renderExpanded?.(row);
        return (
          <li key={getRowKey(row)} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{primary?.cell(row)}</div>
              {secondary && <div className="shrink-0">{secondary.cell(row)}</div>}
            </div>
            {details.length > 0 && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
                {details.map((column) => (
                  <Fragment key={column.key}>
                    <dt className="text-text-secondary">{column.header}</dt>
                    <dd className="text-right text-text-primary">{column.cell(row)}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            {expanded && <div className="mt-3 rounded-lg bg-surface-sunken p-3">{expanded}</div>}
          </li>
        );
      })}
    </ul>
  );
}
