"use client";

import { useState } from "react";

const DEFAULT_PAGE_SIZE = 100;

export function useTablePagination<T>(items: readonly T[], resetKey: string | number, pageSize = DEFAULT_PAGE_SIZE) {
  const [requested, setRequested] = useState({ key: resetKey, page: 1 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const requestedPage = requested.key === resetKey ? requested.page : 1;
  const page = Math.min(requestedPage, pageCount);
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  const setPage = (nextPage: number | ((current: number) => number)) => {
    setRequested((current) => {
      const currentPage = current.key === resetKey ? current.page : 1;
      const page = typeof nextPage === "function" ? nextPage(currentPage) : nextPage;
      return { key: resetKey, page };
    });
  };

  return { page, pageCount, pageItems, pageSize, setPage, total: items.length };
}

export default function TablePagination({
  page,
  pageCount,
  pageSize = DEFAULT_PAGE_SIZE,
  setPage,
  total,
}: {
  page: number;
  pageCount: number;
  pageSize?: number;
  setPage: (page: number | ((current: number) => number)) => void;
  total: number;
}) {
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <footer className="table-pagination">
      <small>Showing {first}-{last} of {total} records</small>
      <div>
        <button className="secondary-button compact" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page} of {pageCount}</span>
        <button className="secondary-button compact" type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>
          Next
        </button>
      </div>
    </footer>
  );
}
