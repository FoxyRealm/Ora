"use client";

export type PendingLedgerEntry = {
  id: string;
  account: string;
  date: string;
  reference: string;
  type: string;
  amount: number;
  direction: "in" | "out";
  category: string;
  contact: string;
  method: string;
  memo: string;
  currency?: "USD" | "SYP";
  sourceAmount?: number;
  exchangeRate?: number;
};

let queuedEntries: PendingLedgerEntry[] = [];

export function queueLedgerEntry(entry: PendingLedgerEntry) {
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) return;
  queuedEntries = [...queuedEntries.filter((item) => item.id !== entry.id), entry];
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ora-ledger-entry"));
}

export function takeQueuedLedgerEntries() {
  const entries = queuedEntries;
  queuedEntries = [];
  return entries;
}
