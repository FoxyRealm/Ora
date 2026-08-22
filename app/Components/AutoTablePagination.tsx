"use client";

import { useEffect } from "react";

const PAGE_SIZE = 100;

export default function AutoTablePagination() {
  useEffect(() => {
    const applyPagination = () => {
      document.querySelectorAll<HTMLTableElement>("table:not([data-no-pagination])").forEach((table) => {
        const body = table.tBodies.item(0);
        if (!body) return;

        const rows = Array.from(body.rows).filter((row) => !row.dataset.paginationControl);
        const pageCount = Math.ceil(rows.length / PAGE_SIZE);
        const existingPager = table.parentElement?.parentElement?.querySelector<HTMLDivElement>(`:scope > .auto-table-pagination[data-for="${table.dataset.paginationId ?? ""}"]`);

        if (pageCount <= 1) {
          rows.forEach((row) => { row.hidden = false; });
          existingPager?.remove();
          return;
        }

        if (!table.dataset.paginationId) {
          table.dataset.paginationId = `table-${crypto.randomUUID()}`;
        }
        const page = Math.min(Math.max(Number(table.dataset.paginationPage) || 1, 1), pageCount);
        table.dataset.paginationPage = String(page);
        rows.forEach((row, index) => { row.hidden = index < (page - 1) * PAGE_SIZE || index >= page * PAGE_SIZE; });

        let pager = table.parentElement?.parentElement?.querySelector<HTMLDivElement>(`:scope > .auto-table-pagination[data-for="${table.dataset.paginationId}"]`);
        if (!pager) {
          pager = document.createElement("div");
          pager.className = "table-pagination auto-table-pagination";
          pager.dataset.for = table.dataset.paginationId;
          table.parentElement?.insertAdjacentElement("afterend", pager);
        }
        const first = (page - 1) * PAGE_SIZE + 1;
        const last = Math.min(page * PAGE_SIZE, rows.length);
        pager.innerHTML = `<small>Showing ${first}-${last} of ${rows.length} records</small><div><button type="button" class="secondary-button compact" data-page="previous" ${page === 1 ? "disabled" : ""}>Previous</button><span>Page ${page} of ${pageCount}</span><button type="button" class="secondary-button compact" data-page="next" ${page === pageCount ? "disabled" : ""}>Next</button></div>`;
        pager.querySelectorAll<HTMLButtonElement>("button[data-page]").forEach((button) => {
          button.onclick = () => {
            table.dataset.paginationPage = String(button.dataset.page === "next" ? page + 1 : page - 1);
            applyPagination();
          };
        });
      });
    };

    applyPagination();
    const observer = new MutationObserver((mutations) => {
      const changedOutsidePagination = mutations.some((mutation) =>
        !(mutation.target instanceof Element) ||
        !mutation.target.closest(".auto-table-pagination"),
      );
      if (changedOutsidePagination) applyPagination();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
