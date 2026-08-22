"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart,
  FileText,
  Paperclip,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import Modal from "../../Components/Modal";
import useDemoState from "../../Components/useDemoState";
import { queueLedgerEntry } from "../../Components/accountingLedger";
import { ACCOUNTING_CURRENCIES, currencyLabel, type AccountingCurrency, type CurrencySettings } from "../../Components/accountingCurrency";
import "../../Style/AccountingOperations.css";

export type OperationsPageId =
  | "expenses"
  | "bills"
  | "purchase-orders"
  | "credit-notes"
  | "drawings"
  | "inventory"
  | "job-costing"
  | "time"
  | "budgets"
  | "assets"
  | "tax"
  | "documents"
  | "recurring"
  | "reports"
  | "audit"
  | "settings";

type Status = "Draft" | "Pending" | "Approved" | "Paid" | "Open" | "Closed" | "Active" | "Paused" | "Filed";
type Expense = { id: string; date: string; description: string; category: string; vendor: string; paidThrough: string; amount: number; status: Status; attachment?: string };
type Bill = { id: string; vendor: string; number: string; description?: string; date: string; due: string; category: string; amount: number; paid: number; status: Status };
type PurchaseOrder = { id: string; vendor: string; date: string; expected: string; item: string; description?: string; quantity: number; total: number; status: "Draft" | "Approved" | "Sent" | "Received" };
type CreditNote = { id: string; customer: string; invoice: string; date: string; reason: string; amount: number; status: "Available" | "Applied" | "Refunded" };
type Drawing = { id: string; date: string; owner: string; kind: "Drawing" | "Contribution"; account: string; amount: number; note: string };
type Material = { id: string; name: string; sku: string; unit: string; onHand: number; reorderAt: number; unitCost: number; supplier: string; usedThisMonth: number };
type WorkTime = { id: string; date: string; employee: string; caseNumber: string; stage: string; hours: number; rate: number; status: "Pending" | "Approved" };
type Budget = { id: string; category: string; period: string; budget: number };
type Asset = { id: string; name: string; category: string; purchased: string; cost: number; lifeYears: number; salvage: number; status: "Active" | "Disposed" };
type FinanceDocument = { id: string; name: string; type: string; linkedTo: string; date: string; owner: string; status: "Linked" | "Needs review" };
type RecurringRule = { id: string; name: string; kind: "Expense" | "Bill" | "Invoice"; frequency: "Weekly" | "Monthly" | "Quarterly"; nextDate: string; amount: number; status: "Active" | "Paused" };
type TaxPeriod = { id: string; period: string; salesTax: number; purchaseTax: number; due: string; status: "Open" | "Filed" };
type AuditEvent = { id: string; date: string; action: string; record: string; user: string; detail: string };
type FinanceSettings = { invoicePrefix: string; paymentTerms: number; taxRate: number; fiscalMonth: string; approvalLimit: number; companyName: string };
type VendorReference = { name: string; category?: string; contact?: string; phone?: string; email?: string; balance?: string; currency?: string };

type OperationsState = {
  expenses: Expense[];
  bills: Bill[];
  purchaseOrders: PurchaseOrder[];
  creditNotes: CreditNote[];
  drawings: Drawing[];
  materials: Material[];
  timeEntries: WorkTime[];
  budgets: Budget[];
  assets: Asset[];
  documents: FinanceDocument[];
  recurring: RecurringRule[];
  taxPeriods: TaxPeriod[];
  audit: AuditEvent[];
  settings: FinanceSettings;
};

type InvoiceLike = { id: string; client: string; patient: string; service: string; amount: number; paid: number; status: string; caseNumber?: string };

const initialState: OperationsState = {
  expenses: [
    { id: "EXP-044", date: "2026-08-11", description: "Zirconia discs restock", category: "Materials", vendor: "Dental Mill Supply", paidThrough: "In Bank Account", amount: 420, status: "Approved", attachment: "zirconia-invoice.pdf" },
    { id: "EXP-043", date: "2026-08-10", description: "Courier delivery", category: "Transport", vendor: "Smile Logistics", paidThrough: "Petty Cash", amount: 18.5, status: "Pending" },
    { id: "EXP-042", date: "2026-08-07", description: "Laboratory utilities", category: "Utilities", vendor: "Damascus Electricity", paidThrough: "In Bank Account", amount: 31, status: "Approved" },
  ],
  bills: [
    { id: "bill-842", vendor: "Dental Mill Supply", number: "BILL-842", date: "2026-08-01", due: "2026-08-14", category: "Materials", amount: 420, paid: 0, status: "Approved" },
    { id: "bill-601", vendor: "OralTech Services", number: "BILL-601", date: "2026-08-05", due: "2026-08-22", category: "Equipment", amount: 340, paid: 0, status: "Open" },
    { id: "bill-188", vendor: "Smile Logistics", number: "BILL-188", date: "2026-08-01", due: "2026-08-09", category: "Transport", amount: 75, paid: 25, status: "Open" },
  ],
  purchaseOrders: [
    { id: "PO-042", vendor: "Dental Mill Supply", date: "2026-08-11", expected: "2026-08-14", item: "Zirconia discs", quantity: 15, total: 420, status: "Sent" },
    { id: "PO-041", vendor: "CeramicWorks", date: "2026-08-10", expected: "2026-08-16", item: "Glaze powder", quantity: 10, total: 130, status: "Approved" },
  ],
  creditNotes: [
    { id: "CN-017", customer: "Dr. Rami Haddad", invoice: "INV-1057", date: "2026-08-09", reason: "Shade remake", amount: 35, status: "Available" },
    { id: "CN-016", customer: "Dr. Layla Mansour", invoice: "INV-1056", date: "2026-08-03", reason: "Case correction", amount: 29, status: "Applied" },
  ],
  drawings: [
    { id: "OWN-003", date: "2026-08-08", owner: "Hassan", kind: "Drawing", account: "In Bank Account", amount: 150, note: "August owner drawing" },
    { id: "OWN-002", date: "2026-08-04", owner: "Hassan", kind: "Contribution", account: "In Bank Account", amount: 500, note: "Working capital contribution" },
  ],
  materials: [
    { id: "MAT-001", name: "Zirconia discs", sku: "ZD-98", unit: "disc", onHand: 14, reorderAt: 6, unitCost: 28, supplier: "Dental Mill Supply", usedThisMonth: 9 },
    { id: "MAT-002", name: "Model resin", sku: "MR-1L", unit: "L", onHand: 2.4, reorderAt: 3, unitCost: 18, supplier: "OralTech Services", usedThisMonth: 4.6 },
    { id: "MAT-003", name: "Glaze powder", sku: "GP-50", unit: "jar", onHand: 9, reorderAt: 3, unitCost: 12, supplier: "CeramicWorks", usedThisMonth: 5 },
  ],
  timeEntries: [
    { id: "TIME-011", date: "2026-08-11", employee: "Lina Darwish", caseNumber: "1058", stage: "Production", hours: 4, rate: 28, status: "Approved" },
    { id: "TIME-010", date: "2026-08-11", employee: "Omar Khoury", caseNumber: "1057", stage: "Glazing", hours: 2.5, rate: 25, status: "Pending" },
  ],
  budgets: [
    { id: "BUD-001", category: "Materials", period: "August 2026", budget: 1200 },
    { id: "BUD-002", category: "Payroll", period: "August 2026", budget: 15000 },
    { id: "BUD-003", category: "Transport", period: "August 2026", budget: 200 },
    { id: "BUD-004", category: "Utilities", period: "August 2026", budget: 350 },
  ],
  assets: [
    { id: "AST-001", name: "Milling unit", category: "Production equipment", purchased: "2025-01-12", cost: 10500, lifeYears: 5, salvage: 1000, status: "Active" },
    { id: "AST-002", name: "3D printer", category: "Production equipment", purchased: "2025-06-08", cost: 3400, lifeYears: 4, salvage: 300, status: "Active" },
    { id: "AST-003", name: "Ceramic furnace", category: "Production equipment", purchased: "2024-09-19", cost: 4700, lifeYears: 6, salvage: 500, status: "Active" },
  ],
  documents: [
    { id: "DOC-021", name: "zirconia-restock.pdf", type: "Supplier bill", linkedTo: "BILL-842", date: "2026-08-11", owner: "Hassan", status: "Linked" },
    { id: "DOC-020", name: "courier-august.jpg", type: "Receipt", linkedTo: "EXP-043", date: "2026-08-10", owner: "Tariq", status: "Linked" },
  ],
  recurring: [
    { id: "REC-001", name: "Laboratory utilities", kind: "Expense", frequency: "Monthly", nextDate: "2026-09-01", amount: 31, status: "Active" },
    { id: "REC-002", name: "Workshop rent", kind: "Bill", frequency: "Monthly", nextDate: "2026-09-01", amount: 400, status: "Active" },
  ],
  taxPeriods: [
    { id: "TAX-2026-08", period: "August 2026", salesTax: 42.6, purchaseTax: 18.25, due: "2026-09-15", status: "Open" },
    { id: "TAX-2026-07", period: "July 2026", salesTax: 39, purchaseTax: 12.5, due: "2026-08-15", status: "Filed" },
  ],
  audit: [
    { id: "AUD-003", date: "2026-08-11 09:42", action: "Payment recorded", record: "INV-1058", user: "Hassan", detail: "$62.00 received" },
    { id: "AUD-002", date: "2026-08-11 08:10", action: "Bill entered", record: "BILL-842", user: "Hassan", detail: "$420.00 payable" },
  ],
  settings: { invoicePrefix: "INV", paymentTerms: 14, taxRate: 5, fiscalMonth: "January", approvalLimit: 250, companyName: "Ora Dental Laboratory" },
};

const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const today = "2026-08-14";
const defaultVendorReferences: VendorReference[] = [
  { name: "Dental Mill Supply", category: "Zirconia & milling", contact: "Nabil Kareem", phone: "+963 11 555 0214", email: "orders@dentalmill.example", balance: "$420.00", currency: "USD" },
  { name: "OralTech Services", category: "Resin & printing", contact: "Rana Saad", phone: "+963 11 555 0322", email: "sales@oraltech.example", balance: "$340.00", currency: "USD" },
  { name: "CeramicWorks", category: "Glazing & ceramics", contact: "Samer Daher", phone: "+963 11 555 0458", email: "support@ceramicworks.example", balance: "$0.00", currency: "USD" },
  { name: "Smile Logistics", category: "Courier & delivery", contact: "Not recorded", phone: "Not recorded", email: "Not recorded", balance: "$75.00", currency: "USD" },
  { name: "Damascus Electricity", category: "Utilities", contact: "Not recorded", phone: "Not recorded", email: "Not recorded", balance: "$0.00", currency: "USD" },
];
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function StatusTag({ value }: { value: string }) {
  const tone = ["Approved", "Paid", "Active", "Filed", "Received", "Applied"].includes(value)
    ? "good"
    : ["Pending", "Open", "Available", "Sent"].includes(value)
      ? "warning"
      : value === "Paused" || value === "Draft"
        ? "neutral"
        : "info";
  return <span className={`ops-status ${tone}`}>{value}</span>;
}

function Heading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <header className="ops-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{children && <div className="ops-heading-actions">{children}</div>}</header>;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FinanceOperationsPage({ page, invoices, currency = "USD", currencySettings, onCurrencySettingsChange, onNotice }: { page: OperationsPageId; invoices: InvoiceLike[]; currency?: string; currencySettings: CurrencySettings; onCurrencySettingsChange: (settings: CurrencySettings) => void; onNotice: (message: string) => void }) {
  const [state, setState] = useDemoState<OperationsState>(initialState);
  const [vendors] = useDemoState<VendorReference[]>(defaultVendorReferences);
  const [dialog, setDialog] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const outstandingBills = state.bills.reduce((sum, bill) => sum + Math.max(0, bill.amount - bill.paid), 0);
  const expenseTotal = state.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  function audit(action: string, record: string, detail: string) {
    const event: AuditEvent = { id: uid("AUD"), date: `${today} 12:00`, action, record, user: "Hassan", detail };
    setState((current) => ({ ...current, audit: [event, ...current.audit].slice(0, 500) }));
  }

  function patchState(updater: (current: OperationsState) => OperationsState, message: string, action: string, record: string) {
    setState((current) => {
      const next = updater(current);
      const event: AuditEvent = { id: uid("AUD"), date: `${today} 12:00`, action, record, user: "Hassan", detail: message };
      return { ...next, audit: [event, ...next.audit].slice(0, 500) };
    });
    setDialog(null);
    onNotice(message);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (dialog === "expense") {
      const amount = Number(form.get("amount"));
      const record: Expense = { id: `EXP-${String(state.expenses.length + 45).padStart(3, "0")}`, date: String(form.get("date")), description: String(form.get("description")).trim(), category: String(form.get("category")), vendor: String(form.get("vendor")).trim(), paidThrough: String(form.get("paidThrough")), amount, status: amount > state.settings.approvalLimit ? "Pending" : "Approved", attachment: (form.get("attachment") as File)?.name || undefined };
      patchState((current) => ({ ...current, expenses: [record, ...current.expenses] }), `${record.id} recorded.`, "Expense recorded", record.id);
      if (record.status === "Approved") queueLedgerEntry({ id: `ledger-${record.id}`, account: record.paidThrough, date: record.date, reference: record.id, type: "Expense", amount: record.amount, direction: "out", category: record.category, contact: record.vendor, method: record.paidThrough === "Petty Cash" ? "Cash" : "Bank transfer", memo: record.description });
    } else if (dialog === "bill") {
      const record: Bill = { id: uid("bill"), vendor: String(form.get("vendor")).trim(), number: String(form.get("number")).trim(), description: String(form.get("description")).trim(), date: String(form.get("date")), due: String(form.get("due")), category: String(form.get("category")), amount: Number(form.get("amount")), paid: 0, status: "Open" };
      patchState((current) => ({ ...current, bills: [record, ...current.bills] }), `${record.number} added to accounts payable.`, "Bill entered", record.number);
    } else if (dialog === "purchase-order") {
      const record: PurchaseOrder = { id: `PO-${String(state.purchaseOrders.length + 43).padStart(3, "0")}`, vendor: String(form.get("vendor")).trim(), date: String(form.get("date")), expected: String(form.get("expected")), item: String(form.get("item")).trim(), description: String(form.get("description")).trim(), quantity: Number(form.get("quantity")), total: Number(form.get("total")), status: "Draft" };
      patchState((current) => ({ ...current, purchaseOrders: [record, ...current.purchaseOrders] }), `${record.id} created.`, "Purchase order created", record.id);
    } else if (dialog === "credit-note") {
      const record: CreditNote = { id: `CN-${String(state.creditNotes.length + 18).padStart(3, "0")}`, customer: String(form.get("customer")), invoice: String(form.get("invoice")), date: String(form.get("date")), reason: String(form.get("reason")).trim(), amount: Number(form.get("amount")), status: "Available" };
      patchState((current) => ({ ...current, creditNotes: [record, ...current.creditNotes] }), `${record.id} issued.`, "Credit note issued", record.id);
    } else if (dialog === "drawing") {
      const record: Drawing = { id: uid("OWN"), date: String(form.get("date")), owner: String(form.get("owner")).trim(), kind: String(form.get("kind")) as Drawing["kind"], account: String(form.get("account")), amount: Number(form.get("amount")), note: String(form.get("note")).trim() };
      patchState((current) => ({ ...current, drawings: [record, ...current.drawings] }), `${record.kind} recorded.`, `${record.kind} recorded`, record.id);
      queueLedgerEntry({ id: `ledger-${record.id}`, account: record.account, date: record.date, reference: record.id, type: record.kind, amount: record.amount, direction: record.kind === "Contribution" ? "in" : "out", category: "Owner equity", contact: record.owner, method: record.account === "Petty Cash" ? "Cash" : "Bank transfer", memo: record.note });
    } else if (dialog === "material") {
      const record: Material = { id: uid("MAT"), name: String(form.get("name")).trim(), sku: String(form.get("sku")).trim(), unit: String(form.get("unit")).trim(), onHand: Number(form.get("onHand")), reorderAt: Number(form.get("reorderAt")), unitCost: Number(form.get("unitCost")), supplier: String(form.get("supplier")).trim(), usedThisMonth: 0 };
      patchState((current) => ({ ...current, materials: [record, ...current.materials] }), `${record.name} added to inventory.`, "Material created", record.id);
    } else if (dialog?.startsWith("adjust:")) {
      const id = dialog.split(":")[1];
      const adjustment = Number(form.get("adjustment"));
      patchState((current) => ({ ...current, materials: current.materials.map((item) => item.id === id ? { ...item, onHand: Math.max(0, item.onHand + adjustment), usedThisMonth: adjustment < 0 ? item.usedThisMonth + Math.abs(adjustment) : item.usedThisMonth } : item) }), "Stock quantity updated.", "Inventory adjusted", id);
    } else if (dialog === "time") {
      const record: WorkTime = { id: uid("TIME"), date: String(form.get("date")), employee: String(form.get("employee")).trim(), caseNumber: String(form.get("caseNumber")).trim(), stage: String(form.get("stage")), hours: Number(form.get("hours")), rate: Number(form.get("rate")), status: "Pending" };
      patchState((current) => ({ ...current, timeEntries: [record, ...current.timeEntries] }), "Time entry submitted for approval.", "Time submitted", record.id);
    } else if (dialog === "budget") {
      const record: Budget = { id: uid("BUD"), category: String(form.get("category")).trim(), period: String(form.get("period")).trim(), budget: Number(form.get("budget")) };
      patchState((current) => ({ ...current, budgets: [record, ...current.budgets] }), `${record.category} budget saved.`, "Budget created", record.id);
    } else if (dialog === "asset") {
      const record: Asset = { id: uid("AST"), name: String(form.get("name")).trim(), category: String(form.get("category")).trim(), purchased: String(form.get("purchased")), cost: Number(form.get("cost")), lifeYears: Number(form.get("lifeYears")), salvage: Number(form.get("salvage")), status: "Active" };
      patchState((current) => ({ ...current, assets: [record, ...current.assets] }), `${record.name} added to fixed assets.`, "Asset created", record.id);
    } else if (dialog === "document") {
      const file = form.get("file") as File;
      const record: FinanceDocument = { id: uid("DOC"), name: file?.name || String(form.get("name")).trim(), type: String(form.get("type")), linkedTo: String(form.get("linkedTo")).trim() || "Unlinked", date: String(form.get("date")), owner: "Hassan", status: String(form.get("linkedTo")).trim() ? "Linked" : "Needs review" };
      patchState((current) => ({ ...current, documents: [record, ...current.documents] }), `${record.name} added to documents.`, "Document captured", record.id);
    } else if (dialog === "recurring") {
      const record: RecurringRule = { id: uid("REC"), name: String(form.get("name")).trim(), kind: String(form.get("kind")) as RecurringRule["kind"], frequency: String(form.get("frequency")) as RecurringRule["frequency"], nextDate: String(form.get("nextDate")), amount: Number(form.get("amount")), status: "Active" };
      patchState((current) => ({ ...current, recurring: [record, ...current.recurring] }), `${record.name} recurrence activated.`, "Recurring rule created", record.id);
    }
  }

  function approveExpense(id: string) {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return;
    patchState((current) => ({ ...current, expenses: current.expenses.map((item) => item.id === id ? { ...item, status: "Approved" } : item) }), `${id} approved.`, "Expense approved", id);
    queueLedgerEntry({ id: `ledger-${expense.id}`, account: expense.paidThrough, date: expense.date, reference: expense.id, type: "Expense", amount: expense.amount, direction: "out", category: expense.category, contact: expense.vendor, method: expense.paidThrough === "Petty Cash" ? "Cash" : "Bank transfer", memo: expense.description });
  }

  function payBill(id: string) {
    const bill = state.bills.find((item) => item.id === id);
    if (!bill) return;
    patchState((current) => ({ ...current, bills: current.bills.map((item) => item.id === id ? { ...item, paid: item.amount, status: "Paid" } : item), expenses: [{ id: `EXP-${String(current.expenses.length + 45).padStart(3, "0")}`, date: today, description: `Payment for ${bill.number}`, category: bill.category, vendor: bill.vendor, paidThrough: "In Bank Account", amount: bill.amount - bill.paid, status: "Approved" }, ...current.expenses] }), `${bill.number} paid and posted as an expense.`, "Bill paid", bill.number);
    queueLedgerEntry({ id: `ledger-bill-${bill.id}`, account: "In Bank Account", date: today, reference: bill.number, type: "Supplier bill payment", amount: bill.amount - bill.paid, direction: "out", category: bill.category, contact: bill.vendor, method: "Bank transfer", memo: `Full payment for ${bill.number}.` });
  }

  function receiveOrder(id: string) {
    const order = state.purchaseOrders.find((item) => item.id === id);
    if (!order) return;
    patchState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((item) => item.id === id ? { ...item, status: "Received" } : item), bills: [{ id: uid("bill"), vendor: order.vendor, number: `BILL-${order.id.replace("PO-", "")}`, date: today, due: "2026-08-28", category: "Materials", amount: order.total, paid: 0, status: "Open" }, ...current.bills] }), `${order.id} received and converted to a bill.`, "Purchase order received", order.id);
  }

  function runRecurring(id: string) {
    const rule = state.recurring.find((item) => item.id === id);
    if (!rule) return;
    patchState((current) => {
      const nextDate = new Date(`${rule.nextDate}T12:00:00`);
      nextDate.setMonth(nextDate.getMonth() + (rule.frequency === "Quarterly" ? 3 : rule.frequency === "Monthly" ? 1 : 0));
      if (rule.frequency === "Weekly") nextDate.setDate(nextDate.getDate() + 7);
      const recurring = current.recurring.map((item) => item.id === id ? { ...item, nextDate: nextDate.toISOString().slice(0, 10) } : item);
      if (rule.kind === "Expense") return { ...current, recurring, expenses: [{ id: uid("EXP"), date: today, description: rule.name, category: "Recurring expense", vendor: "Recurring supplier", paidThrough: "In Bank Account", amount: rule.amount, status: "Approved" }, ...current.expenses] };
      if (rule.kind === "Bill") return { ...current, recurring, bills: [{ id: uid("bill"), vendor: rule.name, number: `BILL-${Date.now().toString().slice(-4)}`, date: today, due: rule.nextDate, category: "Recurring bill", amount: rule.amount, paid: 0, status: "Open" }, ...current.bills] };
      return { ...current, recurring };
    }, `${rule.name} generated for ${today}.`, "Recurring transaction generated", rule.id);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${state.settings.companyName} - Financial summary`, 16, 20);
    doc.setFontSize(10);
    doc.text(`Generated ${today}`, 16, 28);
    doc.text(`Invoice revenue: ${money(invoices.reduce((sum, item) => sum + item.amount, 0), currency)}`, 16, 42);
    doc.text(`Payments received: ${money(invoices.reduce((sum, item) => sum + item.paid, 0), currency)}`, 16, 50);
    doc.text(`Recorded expenses: ${money(expenseTotal, currency)}`, 16, 58);
    doc.text(`Accounts payable: ${money(outstandingBills, currency)}`, 16, 66);
    doc.text(`Net operating result: ${money(invoices.reduce((sum, item) => sum + item.paid, 0) - expenseTotal, currency)}`, 16, 74);
    doc.save(`ora-financial-summary-${today}.pdf`);
    audit("Financial report exported", "REPORT-SUMMARY", "PDF generated");
  }

  const content = (() => {
    const query = search.toLowerCase();
    if (page === "expenses") return <ExpensesView expenses={state.expenses.filter((item) => Object.values(item).join(" ").toLowerCase().includes(query))} total={expenseTotal} search={search} setSearch={setSearch} onAdd={() => setDialog("expense")} onApprove={approveExpense} />;
    if (page === "bills") return <BillsView bills={state.bills} outstanding={outstandingBills} onAdd={() => setDialog("bill")} onPay={payBill} />;
    if (page === "purchase-orders") return <PurchaseOrdersView orders={state.purchaseOrders} onAdd={() => setDialog("purchase-order")} onAdvance={(order) => order.status === "Received" ? undefined : order.status === "Draft" ? patchState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((item) => item.id === order.id ? { ...item, status: "Approved" } : item) }), `${order.id} approved.`, "Purchase order approved", order.id) : order.status === "Approved" ? patchState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((item) => item.id === order.id ? { ...item, status: "Sent" } : item) }), `${order.id} sent to vendor.`, "Purchase order sent", order.id) : receiveOrder(order.id)} />;
    if (page === "credit-notes") return <CreditNotesView notes={state.creditNotes} onAdd={() => setDialog("credit-note")} onAction={(note, status) => patchState((current) => ({ ...current, creditNotes: current.creditNotes.map((item) => item.id === note.id ? { ...item, status } : item) }), `${note.id} ${status.toLowerCase()}.`, `Credit note ${status.toLowerCase()}`, note.id)} />;
    if (page === "drawings") return <DrawingsView entries={state.drawings} onAdd={() => setDialog("drawing")} />;
    if (page === "inventory") return <MaterialsView materials={state.materials} onAdd={() => setDialog("material")} onAdjust={(id) => setDialog(`adjust:${id}`)} />;
    if (page === "job-costing") return <JobCostingView invoices={invoices} materials={state.materials} time={state.timeEntries} currency={currency} />;
    if (page === "time") return <TimeView entries={state.timeEntries} onAdd={() => setDialog("time")} onApprove={(id) => patchState((current) => ({ ...current, timeEntries: current.timeEntries.map((item) => item.id === id ? { ...item, status: "Approved" } : item) }), "Time entry approved.", "Time approved", id)} />;
    if (page === "budgets") return <BudgetsView budgets={state.budgets} expenses={state.expenses} onAdd={() => setDialog("budget")} />;
    if (page === "assets") return <AssetsView assets={state.assets} onAdd={() => setDialog("asset")} />;
    if (page === "tax") return <TaxView periods={state.taxPeriods} onFile={(id) => patchState((current) => ({ ...current, taxPeriods: current.taxPeriods.map((item) => item.id === id ? { ...item, status: "Filed" } : item) }), `${id} marked filed.`, "Tax period filed", id)} />;
    if (page === "documents") return <DocumentsView documents={state.documents} onAdd={() => setDialog("document")} onRemove={(id) => patchState((current) => ({ ...current, documents: current.documents.filter((item) => item.id !== id) }), "Document removed.", "Document removed", id)} />;
    if (page === "recurring") return <RecurringView rules={state.recurring} onAdd={() => setDialog("recurring")} onRun={runRecurring} onToggle={(id) => patchState((current) => ({ ...current, recurring: current.recurring.map((item) => item.id === id ? { ...item, status: item.status === "Active" ? "Paused" : "Active" } : item) }), "Recurring rule updated.", "Recurring rule updated", id)} />;
    if (page === "reports") return <ReportsView invoices={invoices} expenses={state.expenses} bills={state.bills} materials={state.materials} currency={currency} onPdf={exportPdf} />;
    if (page === "audit") return <AuditView events={state.audit} onExport={() => downloadCsv("ora-audit-log.csv", [["Date", "Action", "Record", "User", "Detail"], ...state.audit.map((item) => [item.date, item.action, item.record, item.user, item.detail])])} />;
    return <SettingsView settings={state.settings} currencySettings={currencySettings} onSave={(next, nextCurrencySettings) => { onCurrencySettingsChange(nextCurrencySettings); patchState((current) => ({ ...current, settings: next }), "Accounting and currency settings saved.", "Accounting settings updated", "SETTINGS"); }} />;
  })();

  return <>{content}{dialog && <OperationModal dialog={dialog} invoices={invoices} materials={state.materials} vendors={vendors} onClose={() => setDialog(null)} onSubmit={submit} />}</>;
}

function ExpensesView({ expenses, total, search, setSearch, onAdd, onApprove }: { expenses: Expense[]; total: number; search: string; setSearch: (value: string) => void; onAdd: () => void; onApprove: (id: string) => void }) {
  return <div className="ops-page"><Heading eyebrow="Purchases" title="Expenses" description="Record operating spend, approve higher-value costs, and keep receipt evidence attached."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />Add expense</button></Heading><section className="ops-metrics"><article><ArrowDownRight /><span><small>Total recorded</small><strong>{money(total)}</strong></span></article><article><ClipboardCheck /><span><small>Pending approval</small><strong>{expenses.filter((item) => item.status === "Pending").length}</strong></span></article><article><Paperclip /><span><small>With receipts</small><strong>{expenses.filter((item) => item.attachment).length}</strong></span></article></section><section className="finance-card ops-table-card"><div className="ops-table-head"><div><h3>Expense register</h3><p>{expenses.length} entries</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></div><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Date</th><th>Expense</th><th>Vendor</th><th>Paid through</th><th>Receipt</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td>{item.date}</td><td><strong>{item.description}</strong><small>{item.category} - {item.id}</small></td><td>{item.vendor}</td><td>{item.paidThrough}</td><td>{item.attachment ?? "Missing"}</td><td><strong>{money(item.amount)}</strong></td><td><StatusTag value={item.status} /></td><td>{item.status === "Pending" && <button className="secondary-button compact" type="button" onClick={() => onApprove(item.id)}>Approve</button>}</td></tr>)}</tbody></table></div></section></div>;
}

function BillsView({ bills, outstanding, onAdd, onPay }: { bills: Bill[]; outstanding: number; onAdd: () => void; onPay: (id: string) => void }) {
  const overdue = bills.filter((item) => item.status !== "Paid" && item.due < today);
  return <div className="ops-page"><Heading eyebrow="Purchases" title="Bills and accounts payable" description="Control supplier balances, due dates, partial payments, and expense posting."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />New bill</button></Heading><section className="ops-aging"><article><small>Total payable</small><strong>{money(outstanding)}</strong><span>{bills.filter((item) => item.status !== "Paid").length} open bills</span></article><article className="danger"><small>Overdue</small><strong>{money(overdue.reduce((sum, item) => sum + item.amount - item.paid, 0))}</strong><span>{overdue.length} suppliers need attention</span></article><article><small>Paid this period</small><strong>{money(bills.reduce((sum, item) => sum + item.paid, 0))}</strong><span>Posted to expenses</span></article></section><section className="finance-card ops-table-card"><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Vendor</th><th>Bill</th><th>Due</th><th>Category</th><th>Total</th><th>Balance</th><th>Status</th><th /></tr></thead><tbody>{bills.map((item) => <tr key={item.id}><td><strong>{item.vendor}</strong></td><td><strong>{item.number}</strong>{item.description && <small>{item.description}</small>}</td><td>{item.due}</td><td>{item.category}</td><td>{money(item.amount)}</td><td><strong>{money(item.amount - item.paid)}</strong></td><td><StatusTag value={item.status === "Paid" ? "Paid" : item.due < today ? "Overdue" : item.status} /></td><td><button className="secondary-button compact" type="button" disabled={item.status === "Paid"} onClick={() => onPay(item.id)}>Pay balance</button></td></tr>)}</tbody></table></div></section></div>;
}

function PurchaseOrdersView({ orders, onAdd, onAdvance }: { orders: PurchaseOrder[]; onAdd: () => void; onAdvance: (order: PurchaseOrder) => void }) {
  return <div className="ops-page"><Heading eyebrow="Purchases" title="Purchase orders" description="Approve supplier orders, send them, receive stock, and create the matching payable."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />New purchase order</button></Heading><section className="ops-po-board">{(["Draft", "Approved", "Sent", "Received"] as const).map((status) => <article key={status}><header><span>{status}</span><b>{orders.filter((item) => item.status === status).length}</b></header>{orders.filter((item) => item.status === status).map((order) => <div key={order.id}><strong>{order.id}</strong><p>{order.item}</p>{order.description && <small>{order.description}</small>}<small>{order.vendor} - {order.quantity} units</small><b>{money(order.total)}</b>{status !== "Received" && <button className="secondary-button compact" type="button" onClick={() => onAdvance(order)}>{status === "Draft" ? "Approve" : status === "Approved" ? "Mark sent" : "Receive"}</button>}</div>)}</article>)}</section></div>;
}

function CreditNotesView({ notes, onAdd, onAction }: { notes: CreditNote[]; onAdd: () => void; onAction: (note: CreditNote, status: "Applied" | "Refunded") => void }) {
  return <div className="ops-page"><Heading eyebrow="Sales" title="Credit notes and refunds" description="Correct invoice values without deleting the original financial record."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />New credit note</button></Heading><section className="ops-credit-summary"><span><small>Available credit</small><strong>{money(notes.filter((item) => item.status === "Available").reduce((sum, item) => sum + item.amount, 0))}</strong></span><span><small>Applied</small><strong>{money(notes.filter((item) => item.status === "Applied").reduce((sum, item) => sum + item.amount, 0))}</strong></span><span><small>Refunded</small><strong>{money(notes.filter((item) => item.status === "Refunded").reduce((sum, item) => sum + item.amount, 0))}</strong></span></section><section className="finance-card ops-table-card"><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Credit note</th><th>Customer</th><th>Invoice</th><th>Reason</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{notes.map((item) => <tr key={item.id}><td><strong>{item.id}</strong><small>{item.date}</small></td><td>{item.customer}</td><td>{item.invoice}</td><td>{item.reason}</td><td>{money(item.amount)}</td><td><StatusTag value={item.status} /></td><td>{item.status === "Available" && <div className="ops-row-actions"><button className="secondary-button compact" type="button" onClick={() => onAction(item, "Applied")}>Apply</button><button className="secondary-button compact" type="button" onClick={() => onAction(item, "Refunded")}>Refund</button></div>}</td></tr>)}</tbody></table></div></section></div>;
}

function DrawingsView({ entries, onAdd }: { entries: Drawing[]; onAdd: () => void }) {
  const net = entries.reduce((sum, item) => sum + (item.kind === "Contribution" ? item.amount : -item.amount), 0);
  return <div className="ops-page"><Heading eyebrow="Money" title="Owner equity movements" description="Keep owner drawings and contributions out of operating expenses."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />Record movement</button></Heading><section className="ops-owner-balance"><div><WalletCards size={21} /><span><small>Net owner movement</small><strong className={net >= 0 ? "positive" : "negative"}>{money(net)}</strong></span></div><p>Contributions increase equity. Drawings decrease it.</p></section><section className="ops-ledger-list">{entries.map((item) => <article key={item.id}><span className={item.kind === "Contribution" ? "in" : "out"}>{item.kind === "Contribution" ? <ArrowUpRight /> : <ArrowDownRight />}</span><div><strong>{item.kind} - {item.owner}</strong><small>{item.date} - {item.account}</small><p>{item.note}</p></div><b>{item.kind === "Contribution" ? "+" : "-"}{money(item.amount)}</b></article>)}</section></div>;
}

function MaterialsView({ materials, onAdd, onAdjust }: { materials: Material[]; onAdd: () => void; onAdjust: (id: string) => void }) {
  return <div className="ops-page"><Heading eyebrow="Operations" title="Materials and inventory" description="Track dental stock, reorder points, unit cost, and consumption used in case costing."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />Add material</button></Heading><section className="ops-material-grid">{materials.map((item) => { const low = item.onHand <= item.reorderAt; return <article className={low ? "low" : ""} key={item.id}><header><span><Boxes size={18} /></span><StatusTag value={low ? "Low stock" : "Healthy"} /></header><h3>{item.name}</h3><p>{item.sku} - {item.supplier}</p><div><span><small>On hand</small><strong>{item.onHand} {item.unit}</strong></span><span><small>Stock value</small><strong>{money(item.onHand * item.unitCost)}</strong></span></div><footer><small>{item.usedThisMonth} {item.unit} used this month</small><button className="secondary-button compact" type="button" onClick={() => onAdjust(item.id)}>Adjust stock</button></footer></article>; })}</section></div>;
}

function JobCostingView({ invoices, materials, time, currency }: { invoices: InvoiceLike[]; materials: Material[]; time: WorkTime[]; currency: string }) {
  const avgMaterialCost = materials.reduce((sum, item) => sum + item.unitCost * item.usedThisMonth, 0) / Math.max(invoices.length, 1);
  return <div className="ops-page"><Heading eyebrow="Operations" title="Case profitability" description="Compare each case's revenue with estimated materials and approved technician labor." /><section className="ops-profit-hero"><TrendingUp size={24} /><div><small>Portfolio gross margin</small><strong>{Math.round(invoices.reduce((sum, item) => sum + item.amount, 0) ? (1 - (avgMaterialCost * invoices.length + time.reduce((sum, item) => sum + item.hours * item.rate, 0)) / invoices.reduce((sum, item) => sum + item.amount, 0)) * 100 : 0)}%</strong></div><p>Calculated from current case revenue, material usage, and approved labor.</p></section><section className="finance-card ops-table-card"><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Case</th><th>Doctor</th><th>Service</th><th>Revenue</th><th>Materials</th><th>Labor</th><th>Gross margin</th></tr></thead><tbody>{invoices.map((invoice, index) => { const labor = time.filter((item) => item.caseNumber === invoice.caseNumber).reduce((sum, item) => sum + item.hours * item.rate, 0); const material = avgMaterialCost * (1 + (index % 3) * .12); const margin = invoice.amount ? (invoice.amount - material - labor) / invoice.amount * 100 : 0; return <tr key={invoice.id}><td><strong>#{invoice.caseNumber ?? "Manual"}</strong></td><td>{invoice.client}</td><td>{invoice.service}</td><td>{money(invoice.amount, currency)}</td><td>{money(material, currency)}</td><td>{money(labor, currency)}</td><td><strong className={margin < 30 ? "ops-negative" : "ops-positive"}>{Math.round(margin)}%</strong></td></tr>; })}</tbody></table></div></section></div>;
}

function TimeView({ entries, onAdd, onApprove }: { entries: WorkTime[]; onAdd: () => void; onApprove: (id: string) => void }) {
  return <div className="ops-page"><Heading eyebrow="Operations" title="Technician time" description="Link approved labor to cases and carry its cost into profitability."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />Log time</button></Heading><section className="ops-time-summary"><span><small>Total hours</small><strong>{entries.reduce((sum, item) => sum + item.hours, 0)}h</strong></span><span><small>Labor cost</small><strong>{money(entries.reduce((sum, item) => sum + item.hours * item.rate, 0))}</strong></span><span><small>Pending</small><strong>{entries.filter((item) => item.status === "Pending").length}</strong></span></section><section className="finance-card ops-table-card"><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Date</th><th>Technician</th><th>Case</th><th>Stage</th><th>Hours</th><th>Cost</th><th>Status</th><th /></tr></thead><tbody>{entries.map((item) => <tr key={item.id}><td>{item.date}</td><td><strong>{item.employee}</strong></td><td>#{item.caseNumber}</td><td>{item.stage}</td><td>{item.hours}h</td><td>{money(item.hours * item.rate)}</td><td><StatusTag value={item.status} /></td><td>{item.status === "Pending" && <button className="secondary-button compact" type="button" onClick={() => onApprove(item.id)}>Approve</button>}</td></tr>)}</tbody></table></div></section></div>;
}

function BudgetsView({ budgets, expenses, onAdd }: { budgets: Budget[]; expenses: Expense[]; onAdd: () => void }) {
  return <div className="ops-page"><Heading eyebrow="Control" title="Budgets and forecast" description="Compare category targets with actual spending and spot pressure early."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />Create budget</button></Heading><section className="ops-budget-list">{budgets.map((item) => { const actual = expenses.filter((expense) => expense.category === item.category).reduce((sum, expense) => sum + expense.amount, 0); const percent = Math.min(100, item.budget ? actual / item.budget * 100 : 0); return <article key={item.id}><header><div><strong>{item.category}</strong><small>{item.period}</small></div><b>{money(actual)} / {money(item.budget)}</b></header><div><i style={{ width: `${percent}%` }} /></div><footer><span>{Math.round(percent)}% used</span><strong className={percent > 85 ? "ops-negative" : "ops-positive"}>{money(item.budget - actual)} remaining</strong></footer></article>; })}</section></div>;
}

function AssetsView({ assets, onAdd }: { assets: Asset[]; onAdd: () => void }) {
  return <div className="ops-page"><Heading eyebrow="Control" title="Fixed assets" description="Track equipment cost, straight-line depreciation, and current book value."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />Add asset</button></Heading><section className="ops-asset-summary"><span><small>Assets at cost</small><strong>{money(assets.reduce((sum, item) => sum + item.cost, 0))}</strong></span><span><small>Annual depreciation</small><strong>{money(assets.reduce((sum, item) => sum + (item.cost - item.salvage) / item.lifeYears, 0))}</strong></span><span><small>Active equipment</small><strong>{assets.filter((item) => item.status === "Active").length}</strong></span></section><section className="finance-card ops-table-card"><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Asset</th><th>Purchased</th><th>Cost</th><th>Useful life</th><th>Annual depreciation</th><th>Book value</th><th>Status</th></tr></thead><tbody>{assets.map((item) => { const years = Math.max(0, (new Date(today).getTime() - new Date(item.purchased).getTime()) / 31557600000); const annual = (item.cost - item.salvage) / item.lifeYears; const book = Math.max(item.salvage, item.cost - annual * years); return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.category}</small></td><td>{item.purchased}</td><td>{money(item.cost)}</td><td>{item.lifeYears} years</td><td>{money(annual)}</td><td><strong>{money(book)}</strong></td><td><StatusTag value={item.status} /></td></tr>; })}</tbody></table></div></section></div>;
}

function TaxView({ periods, onFile }: { periods: TaxPeriod[]; onFile: (id: string) => void }) {
  const open = periods.find((item) => item.status === "Open");
  return <div className="ops-page"><Heading eyebrow="Control" title="Tax center" description="Review collected and recoverable tax before marking a period filed." />{open && <section className="ops-tax-hero"><div><span>Current period</span><h3>{open.period}</h3><p>Due {open.due}</p></div><span><small>Tax collected</small><strong>{money(open.salesTax)}</strong></span><span><small>Tax paid</small><strong>{money(open.purchaseTax)}</strong></span><span><small>Net payable</small><strong>{money(open.salesTax - open.purchaseTax)}</strong></span><button className="primary-button" type="button" onClick={() => onFile(open.id)}><CheckCircle2 size={16} />Mark filed</button></section>}<section className="finance-card ops-table-card"><div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Period</th><th>Due</th><th>Collected</th><th>Recoverable</th><th>Net</th><th>Status</th></tr></thead><tbody>{periods.map((item) => <tr key={item.id}><td><strong>{item.period}</strong></td><td>{item.due}</td><td>{money(item.salesTax)}</td><td>{money(item.purchaseTax)}</td><td>{money(item.salesTax - item.purchaseTax)}</td><td><StatusTag value={item.status} /></td></tr>)}</tbody></table></div></section></div>;
}

function DocumentsView({ documents, onAdd, onRemove }: { documents: FinanceDocument[]; onAdd: () => void; onRemove: (id: string) => void }) {
  return <div className="ops-page"><Heading eyebrow="Control" title="Documents and receipts" description="Capture supporting files and link them to the financial record they prove."><button className="primary-button" type="button" onClick={onAdd}><Upload size={16} />Add document</button></Heading><section className="ops-document-grid">{documents.map((item) => <article key={item.id}><header><span><FileText size={20} /></span><StatusTag value={item.status} /></header><strong>{item.name}</strong><p>{item.type}</p><dl><div><dt>Linked to</dt><dd>{item.linkedTo}</dd></div><div><dt>Uploaded</dt><dd>{item.date}</dd></div><div><dt>Owner</dt><dd>{item.owner}</dd></div></dl><button className="danger-button compact" type="button" onClick={() => onRemove(item.id)}><Trash2 size={14} />Remove</button></article>)}</section></div>;
}

function RecurringView({ rules, onAdd, onRun, onToggle }: { rules: RecurringRule[]; onAdd: () => void; onRun: (id: string) => void; onToggle: (id: string) => void }) {
  return <div className="ops-page"><Heading eyebrow="Control" title="Recurring transactions" description="Generate predictable expenses and bills without entering the same information repeatedly."><button className="primary-button" type="button" onClick={onAdd}><Plus size={16} />New recurring rule</button></Heading><section className="ops-recurring-list">{rules.map((item) => <article key={item.id}><span className="ops-recurring-icon"><RefreshCw size={18} /></span><div><strong>{item.name}</strong><small>{item.kind} - {item.frequency}</small></div><span><small>Next date</small><strong>{item.nextDate}</strong></span><b>{money(item.amount)}</b><StatusTag value={item.status} /><div className="ops-row-actions"><button className="secondary-button compact" type="button" disabled={item.status === "Paused"} onClick={() => onRun(item.id)}>Run now</button><button className="secondary-button compact" type="button" onClick={() => onToggle(item.id)}>{item.status === "Active" ? "Pause" : "Resume"}</button></div></article>)}</section></div>;
}

function ReportsView({ invoices, expenses, bills, materials, currency, onPdf }: { invoices: InvoiceLike[]; expenses: Expense[]; bills: Bill[]; materials: Material[]; currency: string; onPdf: () => void }) {
  const reports = [
    ["Profit and loss", "Income, cost, and operating result", invoices.reduce((sum, item) => sum + item.amount, 0) - expenses.reduce((sum, item) => sum + item.amount, 0)],
    ["Accounts receivable aging", "Outstanding dentist balances", invoices.reduce((sum, item) => sum + item.amount - item.paid, 0)],
    ["Accounts payable aging", "Open supplier balances", bills.reduce((sum, item) => sum + item.amount - item.paid, 0)],
    ["Material usage", "Stock consumed this month", materials.reduce((sum, item) => sum + item.usedThisMonth * item.unitCost, 0)],
  ] as const;
  return <div className="ops-page"><Heading eyebrow="Control" title="Financial reports" description="Generate decision-ready summaries from the records currently stored in Ora."><button className="primary-button" type="button" onClick={onPdf}><Download size={16} />Export summary PDF</button></Heading><section className="ops-report-grid">{reports.map(([name, description, value]) => <article key={name}><span><FileBarChart size={19} /></span><div><h3>{name}</h3><p>{description}</p></div><strong>{money(value, currency)}</strong><button className="secondary-button compact" type="button" onClick={() => downloadCsv(`${name.toLowerCase().replaceAll(" ", "-")}.csv`, [["Report", "Value"], [name, value]])}>Export CSV</button></article>)}</section></div>;
}

function AuditView({ events, onExport }: { events: AuditEvent[]; onExport: () => void }) {
  return <div className="ops-page"><Heading eyebrow="Control" title="Accounting audit log" description="Trace who changed each financial record and what the action affected."><button className="secondary-button" type="button" onClick={onExport}><Download size={16} />Export audit</button></Heading><section className="ops-audit-timeline">{events.map((item) => <article key={item.id}><span><ShieldCheck size={16} /></span><div><strong>{item.action}</strong><p>{item.record} - {item.detail}</p><small>{item.user} - {item.date}</small></div></article>)}</section></div>;
}

function SettingsView({ settings, currencySettings, onSave }: { settings: FinanceSettings; currencySettings: CurrencySettings; onSave: (settings: FinanceSettings, currencySettings: CurrencySettings) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ratesToUsd = {
      USD: 1,
      EUR: Math.max(0.000001, Number(form.get("rate-EUR")) || 1),
      SYP: Math.max(0.000001, Number(form.get("rate-SYP")) || 1),
    } as CurrencySettings["ratesToUsd"];
    onSave(
      { companyName: String(form.get("companyName")).trim(), invoicePrefix: String(form.get("invoicePrefix")).trim(), paymentTerms: Number(form.get("paymentTerms")), taxRate: Number(form.get("taxRate")), fiscalMonth: String(form.get("fiscalMonth")), approvalLimit: Number(form.get("approvalLimit")) },
      { baseCurrency: String(form.get("baseCurrency")) as AccountingCurrency, ratesToUsd, updatedAt: "2026-08-15" },
    );
  }
  return <div className="ops-page"><Heading eyebrow="Control" title="Accounting settings" description="Set numbering, currencies, payment terms, tax defaults, approval controls, and company details." /><form className="ops-settings-form" onSubmit={submit}><section><header><Settings2 size={18} /><div><h3>Company and numbering</h3><p>Used on invoices, statements, and financial reports.</p></div></header><div className="ops-form-grid"><label className="field span-2"><span>Company name</span><input name="companyName" defaultValue={settings.companyName} required /></label><label className="field"><span>Invoice prefix</span><input name="invoicePrefix" defaultValue={settings.invoicePrefix} required /></label><label className="field"><span>Default payment terms</span><input name="paymentTerms" type="number" min="0" defaultValue={settings.paymentTerms} required /></label></div></section><section><header><BadgeDollarSign size={18} /><div><h3>Tax and approvals</h3><p>Defaults for new financial records.</p></div></header><div className="ops-form-grid"><label className="field"><span>Default tax rate (%)</span><input name="taxRate" type="number" min="0" step="0.01" defaultValue={settings.taxRate} /></label><label className="field"><span>Expense approval threshold</span><input name="approvalLimit" type="number" min="0" step="0.01" defaultValue={settings.approvalLimit} /></label><label className="field span-2"><span>Fiscal year starts</span><select name="fiscalMonth" defaultValue={settings.fiscalMonth}>{["January", "April", "July", "October"].map((month) => <option key={month}>{month}</option>)}</select></label></div></section><section className="ops-currency-settings"><header><BadgeDollarSign size={18} /><div><h3>Multi-currency</h3><p>Set the reporting currency and manual exchange rates used in Ora.</p></div></header><div className="ops-form-grid"><label className="field span-2"><span>Base reporting currency</span><select name="baseCurrency" defaultValue={currencySettings.baseCurrency}>{ACCOUNTING_CURRENCIES.map((item) => <option value={item} key={item}>{currencyLabel(item)}</option>)}</select></label><div className="ops-currency-rate-note span-2">Rates are expressed as the USD value of 1 unit. USD is fixed at 1.00. Update these manually when your accounting policy requires it.</div>{ACCOUNTING_CURRENCIES.filter((item) => item !== "USD").map((item) => <label className="field" key={item}><span>1 {item} in USD</span><input name={`rate-${item}`} type="number" min="0.000001" step="any" defaultValue={currencySettings.ratesToUsd[item]} required /></label>)}</div></section><footer><button className="primary-button" type="submit"><Check size={16} />Save accounting settings</button></footer></form></div>;
}

function OperationModal({ dialog, invoices, materials, vendors, onClose, onSubmit }: { dialog: string; invoices: InvoiceLike[]; materials: Material[]; vendors: VendorReference[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const adjusted = dialog.startsWith("adjust:") ? materials.find((item) => item.id === dialog.split(":")[1]) : null;
  const titles: Record<string, string> = { expense: "Add expense", bill: "Enter supplier bill", "purchase-order": "New purchase order", "credit-note": "Issue credit note", drawing: "Record owner movement", material: "Add material", time: "Log technician time", budget: "Create budget", asset: "Add fixed asset", document: "Add document", recurring: "New recurring rule" };
  return <Modal title={adjusted ? `Adjust ${adjusted.name}` : titles[dialog] ?? "New financial record"} subtitle="This record is saved locally and included in Ora's accounting reports." onClose={onClose}><form className="ops-entry-form" onSubmit={onSubmit}>
    {dialog === "expense" && <><label className="field span-2"><span>Description</span><input name="description" required /></label><label className="field"><span>Expense account</span><select name="category"><option>Materials</option><option>Transport</option><option>Utilities</option><option>Rent</option><option>Payroll</option><option>Repairs</option><option>Other Expenses</option></select></label><label className="field"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Paid through</span><select name="paidThrough"><option>In Bank Account</option><option>Petty Cash</option><option>Undeposited Funds</option></select></label><label className="field"><span>Vendor</span><input name="vendor" required /></label><label className="field"><span>Date</span><input name="date" type="date" defaultValue={today} required /></label><label className="field"><span>Receipt</span><input name="attachment" type="file" /></label></>}
    {dialog === "bill" && <><label className="field span-2"><span>Vendor</span><select name="vendor" defaultValue="" required><option value="" disabled>Select a vendor</option>{vendors.map((vendor) => <option value={vendor.name} key={vendor.name}>{vendor.name}</option>)}</select></label><label className="field span-2"><span>Description</span><input name="description" placeholder="e.g. Zirconia discs and milling supplies" required /></label><label className="field"><span>Bill number</span><input name="number" required /></label><label className="field"><span>Category</span><select name="category"><option>Materials</option><option>Equipment</option><option>Transport</option><option>Utilities</option><option>Other Expenses</option></select></label><label className="field"><span>Bill date</span><input name="date" type="date" defaultValue={today} required /></label><label className="field"><span>Due date</span><input name="due" type="date" required /></label><label className="field span-2"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" required /></label></>}
    {dialog === "purchase-order" && <><label className="field span-2"><span>Vendor</span><select name="vendor" defaultValue="" required><option value="" disabled>Select a vendor</option>{vendors.map((vendor) => <option value={vendor.name} key={vendor.name}>{vendor.name}</option>)}</select></label><label className="field span-2"><span>Item</span><input name="item" placeholder="e.g. Zirconia discs" required /></label><label className="field span-2"><span>Description</span><input name="description" placeholder="e.g. 15 discs, 98 mm, multilayer shade" required /></label><label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" required /></label><label className="field"><span>Total</span><input name="total" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Order date</span><input name="date" type="date" defaultValue={today} required /></label><label className="field"><span>Expected date</span><input name="expected" type="date" required /></label></>}
    {dialog === "credit-note" && <><label className="field"><span>Customer</span><input name="customer" list="credit-customers" required /><datalist id="credit-customers">{[...new Set(invoices.map((item) => item.client))].map((name) => <option value={name} key={name} />)}</datalist></label><label className="field"><span>Invoice</span><select name="invoice">{invoices.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label className="field span-2"><span>Reason</span><input name="reason" required /></label><label className="field"><span>Date</span><input name="date" type="date" defaultValue={today} /></label><label className="field"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" required /></label></>}
    {dialog === "drawing" && <><label className="field"><span>Movement type</span><select name="kind"><option>Drawing</option><option>Contribution</option></select></label><label className="field"><span>Owner</span><input name="owner" defaultValue="Hassan" required /></label><label className="field"><span>Account</span><select name="account"><option>In Bank Account</option><option>Petty Cash</option></select></label><label className="field"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Date</span><input name="date" type="date" defaultValue={today} /></label><label className="field"><span>Note</span><input name="note" /></label></>}
    {dialog === "material" && <><label className="field span-2"><span>Material name</span><input name="name" required /></label><label className="field"><span>SKU</span><input name="sku" required /></label><label className="field"><span>Unit</span><input name="unit" placeholder="disc, L, jar" required /></label><label className="field"><span>Opening stock</span><input name="onHand" type="number" min="0" step="0.01" required /></label><label className="field"><span>Reorder point</span><input name="reorderAt" type="number" min="0" step="0.01" required /></label><label className="field"><span>Unit cost</span><input name="unitCost" type="number" min="0" step="0.01" required /></label><label className="field"><span>Supplier</span><input name="supplier" required /></label></>}
    {adjusted && <><div className="ops-adjust-summary"><small>Current stock</small><strong>{adjusted.onHand} {adjusted.unit}</strong></div><label className="field span-2"><span>Adjustment</span><input name="adjustment" type="number" step="0.01" placeholder="Use negative numbers for usage" required /></label></>}
    {dialog === "time" && <><label className="field"><span>Technician</span><input name="employee" required /></label><label className="field"><span>Case number</span><input name="caseNumber" required /></label><label className="field"><span>Stage</span><select name="stage"><option>Design</option><option>Printing</option><option>Production</option><option>Finishing</option><option>Glazing</option><option>Quality Review</option></select></label><label className="field"><span>Date</span><input name="date" type="date" defaultValue={today} /></label><label className="field"><span>Hours</span><input name="hours" type="number" min="0.25" step="0.25" required /></label><label className="field"><span>Hourly cost</span><input name="rate" type="number" min="0" step="0.01" required /></label></>}
    {dialog === "budget" && <><label className="field span-2"><span>Category</span><input name="category" required /></label><label className="field"><span>Period</span><input name="period" defaultValue="August 2026" required /></label><label className="field"><span>Budget amount</span><input name="budget" type="number" min="0" step="0.01" required /></label></>}
    {dialog === "asset" && <><label className="field span-2"><span>Asset name</span><input name="name" required /></label><label className="field span-2"><span>Category</span><input name="category" defaultValue="Production equipment" required /></label><label className="field"><span>Purchase date</span><input name="purchased" type="date" required /></label><label className="field"><span>Cost</span><input name="cost" type="number" min="0" step="0.01" required /></label><label className="field"><span>Useful life (years)</span><input name="lifeYears" type="number" min="1" defaultValue="5" required /></label><label className="field"><span>Salvage value</span><input name="salvage" type="number" min="0" defaultValue="0" /></label></>}
    {dialog === "document" && <><label className="field span-2"><span>File</span><input name="file" type="file" required /></label><label className="field"><span>Document type</span><select name="type"><option>Receipt</option><option>Supplier bill</option><option>Bank statement</option><option>Tax document</option><option>Payroll document</option></select></label><label className="field"><span>Linked record</span><input name="linkedTo" placeholder="e.g. EXP-044" /></label><label className="field span-2"><span>Date</span><input name="date" type="date" defaultValue={today} /></label></>}
    {dialog === "recurring" && <><label className="field span-2"><span>Rule name</span><input name="name" required /></label><label className="field"><span>Transaction type</span><select name="kind"><option>Expense</option><option>Bill</option><option>Invoice</option></select></label><label className="field"><span>Frequency</span><select name="frequency"><option>Weekly</option><option>Monthly</option><option>Quarterly</option></select></label><label className="field"><span>Next date</span><input name="nextDate" type="date" required /></label><label className="field"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" required /></label></>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><CheckCircle2 size={16} />Save record</button></div>
  </form></Modal>;
}
