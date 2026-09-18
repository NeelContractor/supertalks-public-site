import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./ui/pagination";

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis-start");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("ellipsis-end");
  items.push(total);
  return items;
}

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const go = (e: React.MouseEvent<HTMLAnchorElement>, next: number) => {
    e.preventDefault();
    onPageChange(next);
  };
  return (
    <Pagination className="pt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => go(e, page - 1)}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {pageItems(page, totalPages).map((item, i) =>
          typeof item === "number" ? (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(e) => go(e, item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={i}>
              <PaginationEllipsis />
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => go(e, page + 1)}
            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}