"use client";

import { ArrowDownRight, ArrowUpRight, Banknote, BookOpenCheck, BriefcaseBusiness, Building2, CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, CreditCard, FileCheck2, FilePlus2, Files, Hourglass, Landmark, LayoutDashboard, PackageSearch, Plus, Printer, ReceiptText, RefreshCw, Send, Settings2, UsersRound, WalletCards, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Modal from "../Components/Modal";
import TablePagination, { useTablePagination } from "../Components/TablePagination";
import useDemoState from "../Components/useDemoState";
import { queueLedgerEntry } from "../Components/accountingLedger";
import BankingPage from "./accounting/BankingPage";
import ChartOfAccountsPage from "./accounting/ChartOfAccountsPage";
import DoctorsPage from "./accounting/DoctorsPage";
import FinanceOperationsPage, { type OperationsPageId } from "./accounting/FinanceOperationsPage";
import { defaultCurrencySettings, type CurrencySettings } from "../Components/accountingCurrency";
import PaymentsReceivedPage from "./accounting/PaymentsReceivedPage";
import PayrollPage from "./accounting/PayrollPage";
import VendorsPage from "./accounting/VendorsPage";
import type { OraData } from "./mock-data";
import "../Style/AccountingWorkspace.css";
import "../Style/AccountingPayments.css";
import PaymentDepositFields, { type PaymentCurrency } from "../Components/PaymentDepositFields";
import PaymentExchangeRateFields, { paymentAmountInUsd } from "../Components/PaymentExchangeRateFields";
import DatePicker from "../Components/DatePicker";
import { printInvoicePages } from "../Components/InvoicePrint";

type FinancePage = "dashboard" | "invoices" | "doctors" | "payments-received" | "estimates" | "expenses" | "vendors" | "bills" | "banking" | "chart-of-accounts" | "drawings" | "payroll" | "inventory" | "purchase-orders" | "credit-notes" | "tax" | "documents" | "recurring" | "job-costing" | "time" | "budgets" | "assets" | "reports" | "audit" | "settings";
type InvoiceStatus = "Draft" | "Sent" | "Partial" | "Paid" | "Overdue";
type EstimateStatus = "Draft" | "Sent" | "Accepted" | "Declined";
export type InvoicePayment = { id: string; date: string; amount: number; method: string; reference: string; account: string; currency?: PaymentCurrency; sourceAmount?: number; exchangeRate?: number; note: string; receivedBy: string };
export type Invoice = { id: string; client: string; clinic: string; caseId?: string; caseNumber?: string; patient: string; issued: string; due: string; amount: number; paid: number; status: InvoiceStatus; service: string; payments: InvoicePayment[]; doctorAcceptedAt?: string };
type Estimate = { id: string; client: string; patient: string; service: string; amount: number; date: string; expiry: string; status: EstimateStatus };

const fmt = (amount: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
const today = "2026-08-11";

function printAccountingInvoice(invoice: Invoice) {
  return printInvoicePages([{ number: invoice.id, status: invoice.status, brandTitle: "Ora", brandSubtitle: "Dental Laboratory", doctor: invoice.client, clinic: invoice.clinic, patient: invoice.patient, issued: invoice.issued, caseNumber: invoice.caseNumber?.replace(/^ORA-/i, "") || "Manual invoice", services: [{ service: invoice.service, shade: "Not recorded", units: "1", unitPrice: fmt(invoice.amount), amount: fmt(invoice.amount) }], payments: invoice.payments.map((payment) => ({ date: payment.date, label: payment.amount < 0 ? "Payment correction" : "Payment received", amount: fmt(Math.abs(payment.amount)), negative: payment.amount < 0 })), total: fmt(invoice.amount), paid: fmt(invoice.paid), balance: fmt(Math.max(0, invoice.amount - invoice.paid)) }]);
}

function invoicesFromOraData(data: OraData): Invoice[] {
  return data.cases.map((labCase) => {
    const doctor = data.doctors.find((entry) => entry.id === labCase.doctorId);
    const invoiceNumber = labCase.caseNumber.replace(/^ORA-/i, "");
    const amount = labCase.price;
    const paid = labCase.paid;
    const status: InvoiceStatus = amount > 0 && paid >= amount
      ? "Paid"
      : paid > 0
        ? "Partial"
        : labCase.dueDate.slice(0, 10) < today
          ? "Overdue"
          : "Sent";
    const payments = data.payments
      .filter((payment) => payment.caseId === labCase.id)
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((payment, index): InvoicePayment => ({
        id: payment.id,
        date: payment.date.slice(0, 10),
        amount: payment.amount,
        method: payment.method ?? "Cash",
        reference: payment.reference ?? `PAY-${invoiceNumber}-${index + 1}`,
        account: payment.account ?? (payment.method === "Bank" || payment.method === "Bank transfer" ? "In Bank Account" : "Undeposited Funds"),
        currency: payment.currency,
        sourceAmount: payment.sourceAmount,
        exchangeRate: payment.exchangeRate,
        note: payment.note,
        receivedBy: data.staff.find((entry) => entry.id === payment.staffId)?.name ?? "Ora staff",
      }));

    return {
      id: `INV-${invoiceNumber}`,
      client: doctor?.name ?? "Doctor",
      clinic: doctor?.clinic ?? "Independent practice",
      caseId: labCase.id,
      caseNumber: labCase.caseNumber,
      patient: labCase.patient || "Patient not recorded",
      issued: labCase.receivedDate,
      due: labCase.dueDate,
      amount,
      paid,
      status,
      service: labCase.serviceLines.map((line) => line.service).join(", ") || "Dental laboratory service",
      payments,
      doctorAcceptedAt: labCase.invoiceAcceptedAt,
    };
  });
}

const financeNav: { group: string; items: { id: FinancePage; label: string; icon: typeof LayoutDashboard; phase?: string }[] }[] = [
  { group: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "Sales", items: [{ id: "invoices", label: "Invoices", icon: ReceiptText }, { id: "doctors", label: "Doctors", icon: UsersRound }, { id: "payments-received", label: "Payments received", icon: Banknote }, { id: "estimates", label: "Estimates", icon: FileCheck2 }, { id: "credit-notes", label: "Credit notes", icon: Files, phase: "2" }] },
  { group: "Purchases", items: [{ id: "expenses", label: "Expenses", icon: ArrowDownRight, phase: "1" }, { id: "vendors", label: "Vendors", icon: Building2 }, { id: "bills", label: "Bills", icon: ClipboardList, phase: "1" }, { id: "purchase-orders", label: "Purchase orders", icon: FilePlus2, phase: "2" }] },
  { group: "Money", items: [{ id: "banking", label: "Banking", icon: Landmark, phase: "1" }, { id: "chart-of-accounts", label: "Chart of accounts", icon: BookOpenCheck }, { id: "drawings", label: "Owner drawings", icon: WalletCards, phase: "1" }] },
  { group: "Operations", items: [{ id: "payroll", label: "Payroll", icon: UsersRound, phase: "1" }, { id: "inventory", label: "Materials", icon: PackageSearch, phase: "2" }, { id: "job-costing", label: "Case profitability", icon: BriefcaseBusiness, phase: "3" }, { id: "time", label: "Time tracking", icon: CalendarClock, phase: "3" }] },
  { group: "Control", items: [{ id: "reports", label: "Reports", icon: BookOpenCheck, phase: "3" }, { id: "budgets", label: "Budget & forecast", icon: ArrowUpRight, phase: "3" }, { id: "assets", label: "Fixed assets", icon: Building2, phase: "3" }, { id: "tax", label: "Tax center", icon: CircleDollarSign, phase: "2" }, { id: "documents", label: "Documents", icon: Files, phase: "2" }, { id: "recurring", label: "Recurring", icon: RefreshCw, phase: "2" }, { id: "audit", label: "Audit log", icon: ClipboardList, phase: "3" }, { id: "settings", label: "Settings", icon: Settings2, phase: "1" }] },
];

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warning" | "danger" | "info" }) { return <span className={`finance-pill ${tone}`}>{children}</span>; }
function Metric({ label, value, hint, icon: Icon, tone = "teal" }: { label: string; value: string; hint: string; icon: typeof WalletCards; tone?: "teal" | "blue" | "amber" | "rose" }) { return <article className={`finance-metric ${tone}`}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong><p>{hint}</p></div></article>; }


export default function AccountingWorkspacePage({ data, onOpenCase }: { data: OraData; onOpenCase: (id: string) => void }) {
  const [page, setPage] = useState<FinancePage>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<"create" | Invoice | null>(null);
  const [estimateModal, setEstimateModal] = useState<"create" | Estimate | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currencySettings, setCurrencySettings] = useDemoState<CurrencySettings>(defaultCurrencySettings);
  const [invoices, setInvoices] = useDemoState<Invoice[]>(() => invoicesFromOraData(data));
  const [estimates, setEstimates] = useDemoState<Estimate[]>([{ id: "EST-208", client: "Dr. Rami Haddad", patient: "M. Al-Khatib", service: "Implant crown", amount: 175, date: "2026-08-10", expiry: "2026-08-24", status: "Sent" }, { id: "EST-207", client: "Dr. Layla Mansour", patient: "A. Nassar", service: "3-unit zirconia bridge", amount: 225, date: "2026-08-08", expiry: "2026-08-22", status: "Accepted" }, { id: "EST-206", client: "Dr. Rami Haddad", patient: "S. Darwish", service: "Partial denture", amount: 320, date: "2026-08-02", expiry: "2026-08-16", status: "Draft" }]);

  useEffect(() => {
    const caseInvoices = invoicesFromOraData(data);
    setInvoices((current) => [
      ...caseInvoices,
      ...current.filter((invoice) => !invoice.caseNumber),
    ]);
  }, [data, setInvoices]);

  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.amount - invoice.paid, 0);
  const received = invoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const invoiceTotal = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdue = invoices.filter((invoice) => invoice.status === "Overdue").reduce((sum, invoice) => sum + invoice.amount - invoice.paid, 0);

  function createInvoice(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = Number(form.get("amount")); const client = String(form.get("client")).trim(); if (!client || !Number.isFinite(amount) || amount <= 0) return; const next: Invoice = { id: `INV-${1050 + invoices.length}`, client, clinic: String(form.get("clinic")).trim() || "Independent practice", patient: String(form.get("patient")).trim() || "Patient not recorded", service: String(form.get("service")).trim() || "Dental laboratory service", issued: today, due: String(form.get("due")), amount, paid: 0, status: "Draft", payments: [] }; setInvoices((current) => [next, ...current]); setInvoiceModal(null); setNotice(`${next.id} created as a draft.`); }
  function recordPayment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!paymentInvoice) return; const form = new FormData(event.currentTarget); const amount = Number(form.get("usdAmount") ?? form.get("amount")); const method = String(form.get("method")); const date = String(form.get("date")) || today; const reference = String(form.get("reference")).trim() || `PAY-${280 + paymentInvoice.payments.length}`; const account = String(form.get("account")) || (method === "Cash" ? "Undeposited Funds" : "In Bank Account"); const currency: PaymentCurrency = form.get("currency") === "SYP" ? "SYP" : "USD"; const sourceAmount = Number(form.get("amount")); const exchangeRate = currency === "SYP" ? Number(form.get("exchangeRate")) : undefined; const note = String(form.get("note")).trim() || `Payment received against ${paymentInvoice.id}.`; if (!Number.isFinite(amount) || amount <= 0 || amount > paymentInvoice.amount - paymentInvoice.paid) return; const paymentId = `PAY-${Date.now()}`; setInvoices((current) => current.map((invoice) => invoice.id !== paymentInvoice.id ? invoice : (() => { const paid = Math.min(invoice.amount, invoice.paid + amount); return { ...invoice, paid, status: paid >= invoice.amount ? "Paid" : "Partial", payments: [{ id: paymentId, date, amount, method, reference, account, currency, sourceAmount: currency === "SYP" ? sourceAmount : undefined, exchangeRate, note, receivedBy: "Hassan" }, ...invoice.payments] }; })())); queueLedgerEntry({ id: `ledger-${paymentId}`, account, date, reference, type: "Customer payment", amount, direction: "in", category: "Accounts Receivable", contact: paymentInvoice.client, method, memo: note, currency, sourceAmount: currency === "SYP" ? sourceAmount : undefined, exchangeRate }); setPaymentInvoice(null); setNotice("Payment recorded and posted to banking."); }
  function updateInvoicePayment(invoiceId: string, paymentId: string, changes: Pick<InvoicePayment, "date" | "amount" | "method" | "reference" | "account" | "currency" | "sourceAmount" | "exchangeRate" | "note">) { setInvoices((current) => current.map((invoice) => { if (invoice.id !== invoiceId) return invoice; const payments = invoice.payments.map((payment) => payment.id === paymentId ? { ...payment, ...changes } : payment); const paid = payments.reduce((sum, payment) => sum + payment.amount, 0); const status: InvoiceStatus = paid >= invoice.amount ? "Paid" : paid > 0 ? "Partial" : invoice.due < today ? "Overdue" : "Sent"; return { ...invoice, payments, paid: Math.min(invoice.amount, paid), status }; })); setNotice("Payment updated."); }
  function deleteInvoicePayment(invoiceId: string, paymentId: string) { setInvoices((current) => current.map((invoice) => { if (invoice.id !== invoiceId) return invoice; const payments = invoice.payments.filter((payment) => payment.id !== paymentId); const paid = payments.reduce((sum, payment) => sum + payment.amount, 0); const status: InvoiceStatus = paid >= invoice.amount ? "Paid" : paid > 0 ? "Partial" : invoice.due < today ? "Overdue" : "Sent"; return { ...invoice, payments, paid: Math.min(invoice.amount, paid), status }; })); setNotice("Payment deleted."); }
  function addInvoicePayment(customer: string, payment: Pick<InvoicePayment, "date" | "amount" | "method" | "reference" | "account" | "currency" | "sourceAmount" | "exchangeRate" | "note">) { setInvoices((current) => { let remaining = payment.amount; return current.map((invoice) => { if (invoice.client !== customer || remaining <= 0) return invoice; const openBalance = Math.max(0, invoice.amount - invoice.paid); const appliedAmount = Math.min(openBalance, remaining); if (appliedAmount <= 0) return invoice; remaining -= appliedAmount; const paid = invoice.paid + appliedAmount; return { ...invoice, paid, status: paid >= invoice.amount ? "Paid" : "Partial", payments: [{ id: `${payment.reference}-${invoice.id}-${Date.now()}`, ...payment, amount: appliedAmount, sourceAmount: payment.currency === "SYP" ? appliedAmount * (payment.exchangeRate ?? 0) : undefined, note: payment.note || `Payment ${payment.reference} applied to ${invoice.id}.`, receivedBy: "Hassan" }, ...invoice.payments] }; }); }); queueLedgerEntry({ id: `ledger-${payment.reference}-${Date.now()}`, account: payment.account, date: payment.date, reference: payment.reference, type: "Customer payment", amount: payment.amount, direction: "in", category: "Accounts Receivable", contact: customer, method: payment.method, memo: payment.note || `Customer payment from ${customer}.`, currency: payment.currency, sourceAmount: payment.sourceAmount, exchangeRate: payment.exchangeRate }); setNotice(`${payment.reference} recorded and posted to ${payment.account}.`); }
  function createEstimate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = Number(form.get("amount")); const client = String(form.get("client")).trim(); if (!client || !amount) return; const next: Estimate = { id: `EST-${209 + estimates.length}`, client, patient: String(form.get("patient")).trim() || "Patient not recorded", service: String(form.get("service")).trim() || "Dental laboratory service", amount, date: today, expiry: String(form.get("expiry")), status: "Draft" }; setEstimates((current) => [next, ...current]); setEstimateModal(null); setNotice(`${next.id} created as a draft.`); }
  function convertEstimate(estimate: Estimate) { const invoice: Invoice = { id: `INV-${1050 + invoices.length}`, client: estimate.client, clinic: "Independent practice", patient: estimate.patient, issued: today, due: estimate.expiry, amount: estimate.amount, paid: 0, status: "Draft", service: estimate.service, payments: [] }; setInvoices((current) => [invoice, ...current]); setEstimates((current) => current.map((item) => item.id === estimate.id ? { ...item, status: "Accepted" } : item)); setPage("invoices"); setNotice(`${estimate.id} converted into ${invoice.id}.`); }
  const content = page === "dashboard" ? <FinanceDashboard invoices={invoices} received={received} invoiceTotal={invoiceTotal} outstanding={outstanding} overdue={overdue} onCreate={() => setInvoiceModal("create")} onViewInvoices={() => setPage("invoices")} /> : page === "invoices" ? <InvoicePage invoices={invoices} cases={data.cases} onCreate={() => setInvoiceModal("create")} onView={setInvoiceModal} onPayment={setPaymentInvoice} onOpenCase={onOpenCase} onBulkSend={(ids) => { setInvoices((current) => current.map((invoice) => ids.includes(invoice.id) && invoice.status === "Draft" ? { ...invoice, status: "Sent" } : invoice)); setNotice(`${ids.length} invoice${ids.length === 1 ? "" : "s"} prepared and marked sent.`); }} onReminders={(count) => setNotice(`${count} payment reminder${count === 1 ? "" : "s"} added to the outgoing queue.`)} /> : page === "doctors" ? <DoctorsPage data={data} invoices={invoices} onViewInvoice={setInvoiceModal} onOpenCase={onOpenCase} /> : page === "payments-received" ? <PaymentsReceivedPage invoices={invoices} onUpdatePayment={updateInvoicePayment} onDeletePayment={deleteInvoicePayment} onAddPayment={addInvoicePayment} /> : page === "estimates" ? <EstimatePage estimates={estimates} onCreate={() => setEstimateModal("create")} onView={setEstimateModal} onConvert={convertEstimate} /> : page === "vendors" ? <VendorsPage /> : page === "banking" ? <BankingPage currencySettings={currencySettings} casePayments={data.payments.map((payment) => ({ ...payment, doctorName: data.doctors.find((doctor) => doctor.id === payment.doctorId)?.name ?? "Doctor payment" }))} /> : page === "chart-of-accounts" ? <ChartOfAccountsPage /> : page === "payroll" ? <PayrollPage /> : <FinanceOperationsPage page={page as OperationsPageId} invoices={invoices} currency={currencySettings.baseCurrency} currencySettings={currencySettings} onCurrencySettingsChange={setCurrencySettings} onNotice={setNotice} />;
  return <div className={`finance-shell ${collapsed ? "collapsed" : ""}`}>
    <aside className="finance-sidebar"><div className="finance-brand"><span>O</span><div><strong>Ora Finance</strong><small>Financial management</small></div><button className="icon-button" type="button" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle accounting navigation"><ChevronRight size={16} /></button></div><nav>{financeNav.map((group) => <section key={group.group}><small>{group.group}</small>{group.items.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "active" : ""} type="button" onClick={() => setPage(item.id)}><Icon size={16} /><span>{item.label}</span></button>; })}</section>)}</nav></aside>
    <label className="finance-mobile-navigation">
      <span>Accounting page</span>
      <select value={page} onChange={(event) => setPage(event.target.value as FinancePage)} aria-label="Choose accounting page">
        {financeNav.map((group) => <optgroup key={group.group} label={group.group}>{group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}
      </select>
    </label>
    <main className="finance-main">{notice && <div className="finance-notice" role="status"><CheckCircle2 size={16} />{notice}<button type="button" onClick={() => setNotice(null)}>Dismiss</button></div>}{content}</main>
    {invoiceModal && <InvoiceModal invoice={invoiceModal === "create" ? null : invoiceModal} doctors={data.doctors.map((doctor) => doctor.name)} onClose={() => setInvoiceModal(null)} onSubmit={createInvoice} onPayment={(invoice) => { setInvoiceModal(null); setPaymentInvoice(invoice); }} />}
    {estimateModal && <EstimateModal estimate={estimateModal === "create" ? null : estimateModal} doctors={data.doctors.map((doctor) => doctor.name)} onClose={() => setEstimateModal(null)} onSubmit={createEstimate} onConvert={convertEstimate} />}
    {paymentInvoice && <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onSubmit={recordPayment} />}
  </div>;
}

function FinanceDashboard({ invoices, received, invoiceTotal, outstanding, overdue, onCreate, onViewInvoices }: { invoices: Invoice[]; received: number; invoiceTotal: number; outstanding: number; overdue: number; onCreate: () => void; onViewInvoices: () => void }) {
  const [cashFlowDates, setCashFlowDates] = useState({ from: "2026-08-01", to: "2026-08-31" });
  const [activeCashFlowDate, setActiveCashFlowDate] = useState("2026-08-29");
  const profit = received - 286;
  const cashFlowPoints = [{ date: "2026-08-01", label: "01 Aug", incoming: 185.5, outgoing: 0 }, { date: "2026-08-04", label: "04 Aug", incoming: 0, outgoing: 66 }, { date: "2026-08-08", label: "08 Aug", incoming: 80, outgoing: 31 }, { date: "2026-08-11", label: "11 Aug", incoming: 180, outgoing: 438.5 }, { date: "2026-08-15", label: "15 Aug", incoming: 250, outgoing: 42 }, { date: "2026-08-19", label: "19 Aug", incoming: 0, outgoing: 120 }, { date: "2026-08-24", label: "24 Aug", incoming: 155, outgoing: 84 }, { date: "2026-08-29", label: "29 Aug", incoming: 320, outgoing: 52 }];
  const normalizeCashFlowDate = (value: string) => {
    if (value.includes("-")) return value;
    const [month, day, year] = value.split("/");
    return year && month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : value;
  };
  const cashFlowStart = normalizeCashFlowDate(cashFlowDates.from);
  const cashFlowEnd = normalizeCashFlowDate(cashFlowDates.to);
  const filteredCashFlowPoints = cashFlowPoints.filter((point) => point.date >= cashFlowStart && point.date <= cashFlowEnd);
  const visibleCashFlowPoints = filteredCashFlowPoints.length ? filteredCashFlowPoints : cashFlowPoints;
  const cashFlowMaximum = Math.max(...visibleCashFlowPoints.flatMap((point) => [point.incoming, point.outgoing]), 1);
  const totalIncoming = visibleCashFlowPoints.reduce((sum, point) => sum + point.incoming, 0);
  const totalOutgoing = visibleCashFlowPoints.reduce((sum, point) => sum + point.outgoing, 0);
  const activeCashFlowPoint = visibleCashFlowPoints.find((point) => point.date === activeCashFlowDate) ?? visibleCashFlowPoints[visibleCashFlowPoints.length - 1];
  const chartWidth = 760;
  const chartHeight = 184;
  const chartPadding = { left: 34, right: 14, top: 12, bottom: 24 };
  const chartSpan = chartWidth - chartPadding.left - chartPadding.right;
  const chartRise = chartHeight - chartPadding.top - chartPadding.bottom;
  const xForPoint = (index: number) => chartPadding.left + (visibleCashFlowPoints.length === 1 ? chartSpan / 2 : index * chartSpan / (visibleCashFlowPoints.length - 1));
  const yForValue = (value: number) => chartPadding.top + chartRise - value / cashFlowMaximum * chartRise;
  const makeLine = (key: "incoming" | "outgoing") => {
    const points = visibleCashFlowPoints.map((point, index) => ({
      x: xForPoint(index),
      y: yForValue(point[key]),
    }));
    if (points.length < 2) return `M${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;

    return points.slice(0, -1).reduce((path, point, index) => {
      const previous = points[index - 1] ?? point;
      const next = points[index + 1];
      const afterNext = points[index + 2] ?? next;
      const firstControl = {
        x: point.x + (next.x - previous.x) / 6,
        y: point.y + (next.y - previous.y) / 6,
      };
      const secondControl = {
        x: next.x - (afterNext.x - point.x) / 6,
        y: next.y - (afterNext.y - point.y) / 6,
      };
      return `${path} C${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${next.x} ${next.y}`;
    }, `M${points[0].x} ${points[0].y}`);
  };
  const setCashFlowDate = (boundary: "from" | "to", value: string) => setCashFlowDates((current) => ({ ...current, [boundary]: value }));

  return <div className="finance-page">
    <section className="finance-hero"><div><span>Financial command center</span><h2>Cash is steady. Collections need attention.</h2><p>Ora has {invoices.filter((invoice) => invoice.status !== "Paid").length} invoices requiring follow-up this month.</p></div><div><button className="primary-button" type="button" onClick={onCreate}><Plus size={16} />Create invoice</button><button className="secondary-button" type="button" onClick={onViewInvoices}><ReceiptText size={16} />Review receivables</button></div></section>
    <section className="finance-metrics"><Metric label="Cash position" value={fmt(5820)} hint="Across operating and cash" icon={WalletCards} /><Metric label="Outstanding AR" value={fmt(outstanding)} hint={`${fmt(overdue)} overdue`} icon={ReceiptText} tone="amber" /><Metric label="Unpaid bills" value={fmt(835)} hint="4 supplier bills due" icon={ClipboardList} tone="rose" /><Metric label="This month profit" value={fmt(profit)} hint={`${fmt(invoiceTotal)} invoiced`} icon={ArrowUpRight} tone="blue" /></section>
    <section className="finance-card cash-flow-report" aria-label="Cash flow chart">
      <header className="cash-flow-report-head"><div><span>Cash flow</span><h3>Money in and out</h3><p>Cash movement across the selected period.</p></div><div className="cash-flow-date-controls"><DatePicker label="From" ariaLabel="Cash flow start date" value={cashFlowDates.from} max={cashFlowDates.to} onChange={(value) => setCashFlowDate("from", value)} /><DatePicker label="To" ariaLabel="Cash flow end date" value={cashFlowDates.to} min={cashFlowDates.from} onChange={(value) => setCashFlowDate("to", value)} /></div></header>
      <div className="cash-flow-overview"><span><small>Cash in</small><strong className="incoming">+{fmt(totalIncoming)}</strong></span><span><small>Cash out</small><strong className="outgoing">-{fmt(totalOutgoing)}</strong></span><span><small>Net movement</small><strong className={totalIncoming - totalOutgoing >= 0 ? "incoming" : "outgoing"}>{totalIncoming - totalOutgoing >= 0 ? "+" : "-"}{fmt(Math.abs(totalIncoming - totalOutgoing))}</strong></span><div className="cash-flow-day-detail"><small>{activeCashFlowPoint.label}</small><strong>{fmt(activeCashFlowPoint.incoming - activeCashFlowPoint.outgoing)}</strong><span>{fmt(activeCashFlowPoint.incoming)} in · {fmt(activeCashFlowPoint.outgoing)} out</span></div></div>
      <div className="cash-flow-chart-wrap"><div className="cash-flow-legend"><span><i className="incoming" />Cash in</span><span><i className="outgoing" />Cash out</span></div><svg className="cash-flow-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Cash flow trend with cash in and cash out"><defs><linearGradient id="cash-flow-income" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#34a693" stopOpacity=".28" /><stop offset="1" stopColor="#34a693" stopOpacity="0" /></linearGradient><linearGradient id="cash-flow-expense" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ca7380" stopOpacity=".18" /><stop offset="1" stopColor="#ca7380" stopOpacity="0" /></linearGradient></defs>{[0.25, 0.5, 0.75, 1].map((fraction) => <line key={fraction} className="cash-flow-gridline" x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={chartPadding.top + chartRise * (1 - fraction)} y2={chartPadding.top + chartRise * (1 - fraction)} />)}<path className="cash-flow-area incoming" d={`${makeLine("incoming")} L ${xForPoint(visibleCashFlowPoints.length - 1)} ${chartHeight - chartPadding.bottom} L ${xForPoint(0)} ${chartHeight - chartPadding.bottom} Z`} /><path className="cash-flow-area outgoing" d={`${makeLine("outgoing")} L ${xForPoint(visibleCashFlowPoints.length - 1)} ${chartHeight - chartPadding.bottom} L ${xForPoint(0)} ${chartHeight - chartPadding.bottom} Z`} /><path className="cash-flow-line incoming" d={makeLine("incoming")} /><path className="cash-flow-line outgoing" d={makeLine("outgoing")} />{visibleCashFlowPoints.map((point, index) => <g key={point.date} className={activeCashFlowPoint.date === point.date ? "active" : ""} onMouseEnter={() => setActiveCashFlowDate(point.date)} onFocus={() => setActiveCashFlowDate(point.date)}><circle className="cash-flow-hit-area" cx={xForPoint(index)} cy={chartHeight / 2} r="18" tabIndex={0} aria-label={`${point.label}: ${fmt(point.incoming)} cash in and ${fmt(point.outgoing)} cash out`} /><circle className="cash-flow-point incoming" cx={xForPoint(index)} cy={yForValue(point.incoming)} r="4" /><circle className="cash-flow-point outgoing" cx={xForPoint(index)} cy={yForValue(point.outgoing)} r="4" /><text x={xForPoint(index)} y={chartHeight - 6}>{point.label}</text></g>)}</svg></div>
    </section>
    <section className="finance-dashboard-grid finance-dashboard-grid-secondary"><article className="finance-card receivable-card"><div className="finance-card-head"><div><span>Receivables</span><h3>Needs attention</h3></div><button type="button" onClick={onViewInvoices}>Open invoices <ChevronRight size={14} /></button></div><div className="attention-list">{invoices.filter((invoice) => invoice.status !== "Paid").slice(0, 3).map((invoice) => <div key={invoice.id}><span><strong>{invoice.client}</strong><small>{invoice.id} · due {invoice.due}</small></span><b>{fmt(invoice.amount - invoice.paid)}</b><Pill tone={invoice.status === "Overdue" ? "danger" : invoice.status === "Partial" ? "warning" : "info"}>{invoice.status}</Pill></div>)}</div></article><article className="finance-card activity-card"><div className="finance-card-head"><div><span>Latest activity</span><h3>Money movement</h3></div></div><div className="activity-list"><div><span className="activity-icon good"><ArrowDownRight size={15} /></span><p><strong>Payment received</strong><small>Dr. Layla Mansour · INV-1050</small></p><b>+{fmt(80)}</b></div><div><span className="activity-icon rose"><CreditCard size={15} /></span><p><strong>Supplier bill entered</strong><small>Dental Mill Supply · zirconia discs</small></p><b>-{fmt(420)}</b></div><div><span className="activity-icon blue"><FileCheck2 size={15} /></span><p><strong>Estimate accepted</strong><small>EST-207 · 3-unit bridge</small></p><b>{fmt(225)}</b></div></div></article></section>
  </div>;
}

function InvoicePage({ invoices, cases, onCreate, onView, onPayment, onOpenCase, onBulkSend, onReminders }: { invoices: Invoice[]; cases: OraData["cases"]; onCreate: () => void; onView: (invoice: Invoice) => void; onPayment: (invoice: Invoice) => void; onOpenCase: (id: string) => void; onBulkSend: (ids: string[]) => void; onReminders: (count: number) => void }) {
  const [filter, setFilter] = useState<"All" | InvoiceStatus>("All");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = filter === "All" ? invoices : invoices.filter((invoice) => invoice.status === filter);
  const selectable = visible.filter((invoice) => invoice.status === "Draft").map((invoice) => invoice.id);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const linkedCaseId = (invoice: Invoice) =>
    invoice.caseId ?? cases.find((labCase) => labCase.caseNumber === invoice.caseNumber)?.id;
  const invoicePagination = useTablePagination(visible, filter);

  return <div className="finance-page">
    <section className="finance-page-heading"><div><span>Sales</span><h2>Invoices</h2><p>Case-linked billing, payment history, and client balances.</p></div><div><button className="secondary-button" type="button" onClick={() => { const ids = selected.length ? selected : selectable; if (ids.length) { onBulkSend(ids); setSelected([]); } }} disabled={!selected.length && !selectable.length}>Batch send {selected.length ? `(${selected.length})` : "drafts"}</button><button className="primary-button" type="button" onClick={onCreate}><Plus size={16} />New invoice</button></div></section>
    <section className="finance-summary-strip"><span><small>Open invoices</small><strong>{invoices.filter((invoice) => invoice.status !== "Paid").length}</strong></span><span><small>Awaiting payment</small><strong>{fmt(invoices.reduce((sum, invoice) => sum + invoice.amount - invoice.paid, 0))}</strong></span><span><small>Collection rate</small><strong>{Math.round(invoices.reduce((sum, invoice) => sum + invoice.paid, 0) / Math.max(invoices.reduce((sum, invoice) => sum + invoice.amount, 0), 1) * 100)}%</strong></span></section>
    <section className="finance-card finance-table-card"><div className="finance-table-toolbar"><label className="finance-status-filter"><span>Invoice status</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>{(["All", "Draft", "Sent", "Partial", "Paid", "Overdue"] as const).map((item) => <option key={item}>{item}</option>)}</select></label><button className="secondary-button compact" type="button" onClick={() => onReminders(invoices.filter((invoice) => invoice.status === "Overdue" || invoice.status === "Partial").length)}><Send size={15} />Queue reminders</button></div>
      <div className="finance-table-scroll"><table className="finance-table invoices-table"><thead><tr><th><input type="checkbox" aria-label="Select draft invoices" checked={Boolean(selectable.length) && selectable.every((id) => selected.includes(id))} onChange={() => setSelected((current) => selectable.every((id) => current.includes(id)) ? current.filter((id) => !selectable.includes(id)) : [...new Set([...current, ...selectable])])} /></th><th>Invoice</th><th>Case no.</th><th>Client / patient</th><th>Due</th><th>Status</th><th>Acceptance</th><th>Balance</th><th /></tr></thead><tbody>{invoicePagination.pageItems.map((invoice) => <tr key={invoice.id}><td><input type="checkbox" aria-label={`Select ${invoice.id}`} checked={selected.includes(invoice.id)} disabled={invoice.status !== "Draft"} onChange={() => toggle(invoice.id)} /></td><td><button className="table-link" type="button" onClick={() => onView(invoice)}>{invoice.id}</button><small className="invoice-service-summary" title={invoice.service}>{invoice.service}</small></td><td>{invoice.caseNumber ? <button className="case-link" type="button" onClick={() => { const caseId = linkedCaseId(invoice); if (caseId) onOpenCase(caseId); }}>{invoice.caseNumber.replace(/^ORA-/i, "")}</button> : <span className="finance-table-muted">—</span>}</td><td><strong>{invoice.client}</strong><small>{invoice.patient}</small></td><td>{invoice.due}</td><td><Pill tone={invoice.status === "Paid" ? "good" : invoice.status === "Overdue" ? "danger" : invoice.status === "Partial" ? "warning" : invoice.status === "Draft" ? "neutral" : "info"}>{invoice.status}</Pill></td><td>{invoice.caseNumber ? <Pill tone={invoice.doctorAcceptedAt ? "good" : "danger"}>{invoice.doctorAcceptedAt ? "Accepted" : "Waiting acceptance"}</Pill> : <span className="finance-table-muted">Not required</span>}</td><td><strong>{fmt(invoice.amount - invoice.paid)}</strong><small>of {fmt(invoice.amount)}</small></td><td><button className="secondary-button compact" type="button" onClick={() => onPayment(invoice)} disabled={invoice.status === "Paid"}>Record payment</button></td></tr>)}</tbody></table></div><TablePagination {...invoicePagination} />
    </section>
  </div>;
}

function EstimatePage({ estimates, onCreate, onView, onConvert }: { estimates: Estimate[]; onCreate: () => void; onView: (estimate: Estimate) => void; onConvert: (estimate: Estimate) => void }) { return <div className="finance-page"><section className="finance-page-heading"><div><span>Sales</span><h2>Estimates</h2><p>Price a treatment plan before committing it to an invoice.</p></div><button className="primary-button" type="button" onClick={onCreate}><Plus size={16} />New estimate</button></section><section className="estimate-grid">{estimates.map((estimate) => <article className="estimate-card" key={estimate.id}><header><span><FileCheck2 size={17} /></span><Pill tone={estimate.status === "Accepted" ? "good" : estimate.status === "Declined" ? "danger" : estimate.status === "Sent" ? "info" : "neutral"}>{estimate.status}</Pill></header><button type="button" onClick={() => onView(estimate)}><strong>{estimate.id}</strong><span>{estimate.client}</span></button><div><small>Patient</small><strong>{estimate.patient}</strong><small>Service</small><strong>{estimate.service}</strong></div><footer><span><small>Expires {estimate.expiry}</small><strong>{fmt(estimate.amount)}</strong></span>{estimate.status !== "Accepted" && estimate.status !== "Declined" && <button className="secondary-button compact" type="button" onClick={() => onConvert(estimate)}>Convert</button>}</footer></article>)}</section></div>; }

function InvoiceModal({ invoice, doctors, onClose, onSubmit, onPayment }: { invoice: Invoice | null; doctors: string[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onPayment: (invoice: Invoice) => void }) {
  if (invoice) return <div className="finance-invoice-drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <aside className="finance-invoice-drawer" role="dialog" aria-modal="true" aria-label={`Invoice ${invoice.id}`}>
      <header><div><span>Invoice</span><h2>{invoice.id}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close invoice"><X size={18} /></button></header>
      <section className="finance-invoice-amount"><small>Balance due</small><strong>{fmt(Math.max(0, invoice.amount - invoice.paid))}</strong><span className={invoice.status.toLowerCase()}>{invoice.status}</span></section>
      <section className="finance-invoice-detail-grid"><div><small>Doctor</small><strong>{invoice.client}</strong></div><div><small>Patient</small><strong>{invoice.patient}</strong></div><div><small>Issued</small><strong>{invoice.issued}</strong></div><div><small>Case</small><strong>{invoice.caseNumber?.replace(/^ORA-/i, "") || "Manual invoice"}</strong></div></section>
      {invoice.caseNumber && <div className={`finance-invoice-acceptance ${invoice.doctorAcceptedAt ? "accepted" : "pending"}`}>{invoice.doctorAcceptedAt ? <CheckCircle2 size={16} /> : <Hourglass size={16} />}<span><strong>{invoice.doctorAcceptedAt ? "Invoice accepted by doctor" : "Invoice awaiting doctor acceptance"}</strong><small>{invoice.doctorAcceptedAt ? invoice.doctorAcceptedAt.slice(0, 10) : "Awaiting confirmation in the doctor portal."}</small></span></div>}
      <section className="finance-invoice-services"><h3>Services</h3><div><span>{invoice.service}</span><strong>{fmt(invoice.amount)}</strong></div><footer><span>Total</span><strong>{fmt(invoice.amount)}</strong></footer></section>
      <section className="finance-invoice-payments"><h3>Payment history</h3>{invoice.payments.map((payment) => <div key={payment.id}><span><strong>{payment.amount < 0 ? "Payment correction" : "Payment received"}</strong><small>{payment.date} · {payment.method} · {payment.reference}</small></span><b>{payment.amount < 0 ? "-" : "+"}{fmt(Math.abs(payment.amount))}</b></div>)}{!invoice.payments.length && <p>No payment has been recorded for this invoice yet.</p>}</section>
      <footer className="finance-invoice-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="secondary-button" type="button" onClick={() => printAccountingInvoice(invoice)}><Printer size={16} />Print invoice</button><button className="primary-button" type="button" disabled={invoice.status === "Paid"} onClick={() => onPayment(invoice)}>Record payment</button></footer>
    </aside>
  </div>;
  return <Modal title="New invoice" subtitle="Create a case-linked or standalone client invoice." onClose={onClose}><form className="modal-form finance-form" onSubmit={onSubmit}><label className="field"><span>Client</span><input name="client" list="finance-doctors" placeholder="Choose or enter a dentist" required /><datalist id="finance-doctors">{doctors.map((doctor) => <option key={doctor} value={doctor} />)}</datalist></label><label className="field"><span>Clinic</span><input name="clinic" placeholder="Clinic or practice" /></label><label className="field"><span>Patient</span><input name="patient" placeholder="Patient name or initials" /></label><label className="field"><span>Service</span><input name="service" placeholder="e.g. Zirconia crown" required /></label><label className="field"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label><label className="field"><span>Due date</span><input name="due" type="date" defaultValue="2026-08-25" required /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save draft</button></div></form></Modal>;
}
function EstimateModal({ estimate, doctors, onClose, onSubmit, onConvert }: { estimate: Estimate | null; doctors: string[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onConvert: (estimate: Estimate) => void }) { if (estimate) return <Modal title={estimate.id} subtitle={`${estimate.client} · ${estimate.patient}`} onClose={onClose}><section className="finance-detail-modal"><div className="invoice-detail-total"><span>Quoted value</span><strong>{fmt(estimate.amount)}</strong><Pill tone={estimate.status === "Accepted" ? "good" : estimate.status === "Sent" ? "info" : "neutral"}>{estimate.status}</Pill></div><dl><div><dt>Service</dt><dd>{estimate.service}</dd></div><div><dt>Expires</dt><dd>{estimate.expiry}</dd></div></dl></section><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button>{estimate.status !== "Accepted" && <button className="primary-button" type="button" onClick={() => { onConvert(estimate); onClose(); }}>Convert to invoice</button>}</div></Modal>; return <Modal title="New estimate" subtitle="Send a quote before the case enters billing." onClose={onClose}><form className="modal-form finance-form" onSubmit={onSubmit}><label className="field"><span>Client</span><input name="client" list="finance-estimate-doctors" required /><datalist id="finance-estimate-doctors">{doctors.map((doctor) => <option key={doctor} value={doctor} />)}</datalist></label><label className="field"><span>Patient</span><input name="patient" placeholder="Patient name or initials" /></label><label className="field"><span>Service</span><input name="service" placeholder="e.g. Implant crown" required /></label><label className="field"><span>Quoted value</span><input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Expiry date</span><input name="expiry" type="date" defaultValue="2026-08-25" required /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save estimate</button></div></form></Modal>; }
function PaymentModal({ invoice, onClose, onSubmit }: { invoice: Invoice; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const remaining = Math.max(0, invoice.amount - invoice.paid);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Bank">("Cash");
  const [account, setAccount] = useState("Undeposited Funds");
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [exchangeRate, setExchangeRate] = useState("13000");
  const receivedAmount = paymentAmountInUsd(amount, currency, exchangeRate);
  const isFullAmount = Math.abs(receivedAmount - remaining) < 0.001;
  const canSubmit = Number.isFinite(receivedAmount) && receivedAmount > 0 && receivedAmount <= remaining;
  const reference = `PAY-${280 + invoice.payments.length}`;
  function changeCurrency(nextCurrency: PaymentCurrency) {
    if (nextCurrency === currency) return;
    const usdAmount = paymentAmountInUsd(amount, currency, exchangeRate);
    const rate = Number(exchangeRate) || 13000;
    setAmount(nextCurrency === "SYP" ? String(Math.round(usdAmount * rate)) : usdAmount.toFixed(2));
    setCurrency(nextCurrency);
  }

  return <Modal title="Record payment" subtitle={`${invoice.id} · ${invoice.client} · ${fmt(remaining)} remaining`} onClose={onClose} wide>
    <form className="payments-new-form finance-payment-modal-form" onSubmit={onSubmit}>
      <section className="payments-new-section"><h3>Invoice and amount</h3><div className="payments-new-grid"><div className="payments-outstanding"><small>Outstanding amount</small><strong>{fmt(remaining)}</strong><span>{invoice.patient} · {invoice.service}</span></div><label className="field"><span>Amount received{currency === "SYP" ? " (SYP)" : " (US$)"}</span><input name="amount" type="number" min="0.01" max={currency === "SYP" ? undefined : remaining} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><button className={`payments-full-amount ${isFullAmount ? "active" : ""}`} type="button" onClick={() => setAmount(currency === "SYP" ? String(Math.round(remaining * (Number(exchangeRate) || 13000))) : remaining.toFixed(2))} disabled={!remaining}><span>Receive full amount</span><strong>{fmt(remaining)}</strong></button></div></section>
      <section className="payments-new-section"><h3>Payment details</h3><div className="payments-new-grid"><label className="field"><span>Payment date</span><input name="date" type="date" defaultValue={today} required /></label><label className="field"><span>Payment #</span><input name="reference" defaultValue={reference} required /></label><div className="payments-mode-field"><span>Payment mode</span><div className="payments-mode-toggle"><button className={paymentMode === "Cash" ? "active" : ""} type="button" onClick={() => setPaymentMode("Cash")}><Banknote size={16} />Cash</button><button className={paymentMode === "Bank" ? "active" : ""} type="button" onClick={() => setPaymentMode("Bank")}><Landmark size={16} />Bank</button></div><input name="method" type="hidden" value={paymentMode === "Cash" ? "Cash" : "Bank transfer"} /></div><PaymentDepositFields account={account} currency={currency} onAccountChange={setAccount} onCurrencyChange={changeCurrency} /><PaymentExchangeRateFields amount={amount} currency={currency} exchangeRate={exchangeRate} onExchangeRateChange={setExchangeRate} /><label className="field span-2"><span>Notes</span><textarea name="note" rows={3} placeholder="Optional payment note" /></label></div></section>
      <footer className="payments-new-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={!canSubmit}><Plus size={16} />Record payment</button></footer>
    </form>
  </Modal>;
}
