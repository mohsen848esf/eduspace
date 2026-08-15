import React from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "w-full flex flex-col gap-3 rounded-2xl border border-[var(--b)] bg-[var(--s2)] p-4 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DataTableToolbar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--b)]/60",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface DataTableSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  value: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}

export const DataTableSearch: React.FC<DataTableSearchProps> = ({
  value,
  onSearchChange,
  placeholder = "Search...",
  className,
  ...props
}) => {
  return (
    <div className="relative flex items-center min-w-[200px] max-w-sm flex-1">
      <Search className="absolute start-3 w-4 h-4 text-[var(--t3)] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-[var(--s3)] text-[var(--t1)] text-xs rounded-xl ps-9 pe-4 py-2",
          "border border-[var(--b)] placeholder-[var(--t3)] outline-none",
          "focus:border-[var(--brand)] transition-colors",
          className
        )}
        {...props}
      />
    </div>
  );
};

export const DataTableContainer: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-[var(--b)]/60 bg-[var(--s1)]",
        className
      )}
      {...props}
    >
      <table className="w-full text-left text-xs text-[var(--t1)] border-collapse">
        {children}
      </table>
    </div>
  );
};

export const DataTableHead: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "center" | "right" }
> = ({ className, align = "left", children, ...props }) => {
  return (
    <th
      className={cn(
        "p-3.5 text-[11px] font-bold uppercase tracking-wider text-[var(--t3)] bg-[var(--s3)]/50 select-none",
        align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
};

export const DataTableRow: React.FC<
  React.HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean }
> = ({ className, hoverable = true, children, ...props }) => {
  return (
    <tr
      className={cn(
        "border-b border-[var(--b)]/40 transition-colors last:border-b-0",
        hoverable && "hover:bg-[var(--s2)]/70",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
};

export const DataTableCell: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "center" | "right" }
> = ({ className, align = "left", children, ...props }) => {
  return (
    <td
      className={cn(
        "p-3.5 align-middle text-xs",
        align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
};

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[var(--b)]/60 text-xs">
      <div className="text-[var(--t3)] font-medium">
        {totalCount !== undefined ? `Total: ${totalCount} items` : `Page ${currentPage} of ${totalPages}`}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="px-2.5 py-1 rounded-lg bg-[var(--s3)] font-semibold text-[var(--t1)]">
          {currentPage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export const DataTableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-[var(--b)]/40 animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-3.5">
              <div className="h-4 bg-[var(--s3)] rounded-md w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default Object.assign(DataTable, {
  Toolbar: DataTableToolbar,
  Search: DataTableSearch,
  Container: DataTableContainer,
  Head: DataTableHead,
  Row: DataTableRow,
  Cell: DataTableCell,
  Pagination: DataTablePagination,
  Skeleton: DataTableSkeleton,
  Empty: EmptyState,
});
