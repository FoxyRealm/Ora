"use client";

import { Banknote, Building2, CalendarDays, ChevronRight, FileText, Landmark, Printer, ReceiptText, Stethoscope, X } from "lucide-react";
import { useMemo, useState } from "react";
import DatePicker from "../../Components/DatePicker";
import Modal from "../../Components/Modal";
import TablePagination, { useTablePagination } from "../../Components/TablePagination";
import type { OraData } from "../mock-data";
import type { Invoice, InvoicePayment } from "../AccountingWorkspacePage";
import "../../Style/AccountingDoctors.css";

type Target = { kind: "doctor"; id: string; label: string; clinic: string } | { kind: "clinic"; label: string; clinic: string };
type StatementPeriod = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month" | "this-year" | "last-year" | "custom";
type PaymentRow = InvoicePayment & { invoice: Invoice };

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

function iso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, count: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return iso(date);
}

function periodRange(period: StatementPeriod, from: string, to: string, referenceDate: string) {
  const base = new Date(`${referenceDate}T12:00:00`);
  const thisWeekStart = new Date(base);
  thisWeekStart.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
  const thisMonthStart = `${referenceDate.slice(0, 8)}01`;
  const lastMonthEnd = new Date(base.getFullYear(), base.getMonth(), 0, 12);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1, 12);
  const range: Record<Exclude<StatementPeriod, "custom">, [string, string]> = {
    today: [referenceDate, referenceDate],
    yesterday: [addDays(referenceDate, -1), addDays(referenceDate, -1)],
    "this-week": [iso(thisWeekStart), referenceDate],
    "last-week": [iso(lastWeekStart), iso(lastWeekEnd)],
    "this-month": [thisMonthStart, referenceDate],
    "last-month": [iso(lastMonthStart), iso(lastMonthEnd)],
    "this-year": [`${base.getFullYear()}-01-01`, referenceDate],
    "last-year": [`${base.getFullYear() - 1}-01-01`, `${base.getFullYear() - 1}-12-31`],
  };
  return period === "custom" ? [from, to] : range[period];
}

function matchesTarget(invoice: Invoice, target: Target) {
  return target.kind === "doctor" ? invoice.client === target.label : invoice.clinic === target.clinic;
}

function InvoiceStatus({ status }: { status: Invoice["status"] }) {
  const tone = status === "Paid" ? "good" : status === "Overdue" ? "danger" : status === "Partial" ? "warning" : status === "Draft" ? "neutral" : "info";
  return <span className={`finance-pill ${tone}`}>{status}</span>;
}

function PaymentDetails({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  return <div className="accounting-doctor-drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <aside className="accounting-doctor-drawer" role="dialog" aria-modal="true" aria-label={`Payment ${payment.reference}`}>
      <header><div><span>{payment.invoice.client}</span><h2>{payment.reference}</h2><p>{payment.invoice.id}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close payment"><X size={18} /></button></header>
      <div className="accounting-doctor-drawer-body">
        <section className="accounting-doctor-payment-amount"><small>Amount received</small><strong>{money(payment.amount)}</strong><span className={payment.method.toLowerCase() === "cash" ? "cash" : "bank"}>{payment.method.toLowerCase() === "cash" ? <Banknote size={14} /> : <Landmark size={14} />}{payment.method}</span></section>
        <section className="accounting-doctor-detail-grid"><div><small>Date received</small><strong>{dateLabel(payment.date)}</strong></div><div><small>Invoice</small><strong>{payment.invoice.id}</strong></div><div><small>Deposit to</small><strong>{payment.account}</strong></div><div><small>Recorded by</small><strong>{payment.receivedBy}</strong></div><div className="span-2"><small>Notes</small><strong>{payment.note || "No additional note."}</strong></div></section>
      </div>
    </aside>
  </div>;
}

function printStatement(target: Target, invoices: Invoice[], payments: PaymentRow[], from: string, to: string) {
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - invoice.paid), 0);
  const popup = window.open("", "_blank", "width=820,height=900");
  if (!popup) return;
  const escape = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const rows = [
    ...invoices.map((invoice) => `<tr class="statement-invoice-row"><td>${escape(dateLabel(invoice.issued))}</td><td>Invoice</td><td>${escape(invoice.id)}</td><td>${escape(invoice.patient)} · ${escape(invoice.service)}</td><td>${escape(money(invoice.amount))}</td></tr>`),
    ...payments.map((payment) => `<tr class="statement-payment-row"><td>${escape(dateLabel(payment.date))}</td><td>Payment</td><td>${escape(payment.reference)}</td><td>${escape(payment.invoice.id)} · ${escape(payment.account)}</td><td>-${escape(money(payment.amount))}</td></tr>`),
  ].join("");
  popup.document.write(`<!doctype html><html><head><title>${escape(target.label)} statement</title><style>*{box-sizing:border-box}body{margin:0;padding:34px;color:#17211f;font-family:Arial,sans-serif;font-size:12px}.head{display:flex;justify-content:space-between;gap:24px;padding-bottom:18px;border-bottom:2px solid #15695f}.brand{color:#15695f;font-size:26px;font-weight:800}.brand small,.title small{display:block;margin-top:4px;color:#65726f;font-size:9px;letter-spacing:1px;text-transform:uppercase}.title{text-align:right}.title h1{margin:0;font-size:20px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.summary div{padding:12px;border:1px solid #dce5e2;background:#f8fbfa}.summary small{display:block;color:#65726f;font-size:9px;text-transform:uppercase}.summary strong{display:block;margin-top:6px;font-size:16px}table{width:100%;border-collapse:collapse;margin-top:15px}th{padding:9px;background:#edf4f2;color:#4e625e;font-size:9px;text-align:left;text-transform:uppercase}th:last-child,td:last-child{text-align:right}td{padding:10px;border-bottom:1px solid #dde7e4}.statement-payment-row td{background:#eff8f5}.statement-payment-row td:first-child{box-shadow:inset 3px 0 #79bdb0}.statement-payment-row td:nth-child(2){color:#176d60;font-weight:800}@media print{body{padding:0}@page{margin:16mm}}</style></head><body><header class="head"><div class="brand">Ora<small>Dental Laboratory</small></div><div class="title"><h1>Account statement</h1><small>${escape(target.label)} · ${escape(dateLabel(from))} to ${escape(dateLabel(to))}</small></div></header><section class="summary"><div><small>Invoiced</small><strong>${escape(money(total))}</strong></div><div><small>Payments</small><strong>${escape(money(paid))}</strong></div><div><small>Outstanding</small><strong>${escape(money(outstanding))}</strong></div></section><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Details</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  const paymentRowStyle = popup.document.createElement("style");
  paymentRowStyle.textContent = ".statement-payment-row td{background:#f3f4f4!important;box-shadow:none!important}.statement-payment-row td:nth-child(2){color:inherit;font-weight:inherit}";
  popup.document.head.append(paymentRowStyle);
  popup.document.close();
}

function StatementModal({ target, invoices, payments, onClose }: { target: Target; invoices: Invoice[]; payments: PaymentRow[]; onClose: () => void }) {
  const [referenceDate] = useState(() => iso(new Date()));
  const [period, setPeriod] = useState<StatementPeriod>("this-month");
  const [from, setFrom] = useState(() => `${iso(new Date()).slice(0, 8)}01`);
  const [to, setTo] = useState(() => iso(new Date()));
  const [start, end] = periodRange(period, from, to, referenceDate);
  const scopedInvoices = invoices.filter((invoice) => invoice.issued >= start && invoice.issued <= end);
  const scopedPayments = payments.filter((payment) => payment.date >= start && payment.date <= end);
  const total = scopedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = scopedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  return <Modal title={`Statement · ${target.label}`} subtitle="Choose the period before printing the account statement." onClose={onClose} wide>
    <div className="accounting-statement-content">
      <div className="accounting-statement-period"><label className="field"><span>Statement period</span><select value={period} onChange={(event) => setPeriod(event.target.value as StatementPeriod)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this-week">This week</option><option value="last-week">Last week</option><option value="this-month">This month</option><option value="last-month">Last month</option><option value="this-year">This year</option><option value="last-year">Last year</option><option value="custom">Custom range</option></select></label>{period === "custom" && <><DatePicker label="From" value={from} onChange={setFrom} max={to} /><DatePicker label="To" value={to} onChange={setTo} min={from} /></>}</div>
      <div className="accounting-statement-range"><CalendarDays size={17} /><span>{dateLabel(start)} to {dateLabel(end)}</span></div>
      <div className="accounting-statement-summary"><div><small>Invoices</small><strong>{money(total)}</strong></div><div><small>Payments</small><strong>{money(paid)}</strong></div><div><small>Outstanding</small><strong>{money(Math.max(0, total - paid))}</strong></div></div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" onClick={() => printStatement(target, scopedInvoices, scopedPayments, start, end)}><Printer size={16} />Print statement</button></div>
    </div>
  </Modal>;
}

export default function DoctorsPage({ data, invoices, onViewInvoice, onOpenCase }: { data: OraData; invoices: Invoice[]; onViewInvoice: (invoice: Invoice) => void; onOpenCase: (caseId: string) => void }) {
  const doctors = data.doctors.filter((doctor) => doctor.active !== false);
  const clinics = Array.from(new Set([...data.clinics, "Independent practice"])).map((clinic) => ({ kind: "clinic" as const, label: clinic, clinic }));
  const [selected, setSelected] = useState<Target | null>(doctors[0] ? { kind: "doctor", id: doctors[0].id, label: doctors[0].name, clinic: doctors[0].clinic } : null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const accountInvoices = useMemo(() => selected ? invoices.filter((invoice) => matchesTarget(invoice, selected)).sort((left, right) => right.issued.localeCompare(left.issued)) : [], [invoices, selected]);
  const accountPayments = useMemo(() => accountInvoices.flatMap((invoice) => invoice.payments.map((item) => ({ ...item, invoice }))).sort((left, right) => right.date.localeCompare(left.date)), [accountInvoices]);
  const invoicePagination = useTablePagination(accountInvoices, `accounting-doctor-invoices-${selected?.kind ?? "none"}-${selected?.label ?? "none"}-${accountInvoices.length}`);
  const paymentPagination = useTablePagination(accountPayments, `accounting-doctor-payments-${selected?.kind ?? "none"}-${selected?.label ?? "none"}-${accountPayments.length}`);
  const outstanding = accountInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - invoice.paid), 0);
  return <div className="accounting-doctors-page">
    <header className="finance-page-heading"><div><span>Sales</span><h2>Doctors</h2><p>Review each doctor or clinic account, invoice activity, payments, and statements.</p></div>{selected && <button className="secondary-button" type="button" onClick={() => setStatementOpen(true)}><FileText size={16} />Make statement</button>}</header>
    <div className="accounting-doctors-layout">
      <aside className="accounting-doctors-directory"><header><Stethoscope size={17} /><div><strong>Doctors & clinics</strong><small>Choose an account to review</small></div></header><section><small>Doctors</small>{doctors.map((doctor) => <button key={doctor.id} type="button" className={selected?.kind === "doctor" && selected.id === doctor.id ? "active" : ""} onClick={() => setSelected({ kind: "doctor", id: doctor.id, label: doctor.name, clinic: doctor.clinic })}><span className="accounting-doctor-avatar">{doctor.name.replace(/^Dr\.\s*/i, "").slice(0, 1)}</span><span><strong>{doctor.name}</strong><small>{doctor.clinic}</small></span><ChevronRight size={15} /></button>)}</section><section><small>Clinics</small>{clinics.map((clinic) => <button key={clinic.clinic} type="button" className={selected?.kind === "clinic" && selected.clinic === clinic.clinic ? "active" : ""} onClick={() => setSelected(clinic)}><span className="accounting-clinic-icon"><Building2 size={15} /></span><span><strong>{clinic.label}</strong><small>{doctors.filter((doctor) => doctor.clinic === clinic.clinic).length} linked doctor{doctors.filter((doctor) => doctor.clinic === clinic.clinic).length === 1 ? "" : "s"}</small></span><ChevronRight size={15} /></button>)}</section></aside>
      <div className="accounting-doctors-account">{selected ? <><header className="accounting-doctors-account-head"><div><span>{selected.kind === "doctor" ? "Doctor account" : "Clinic account"}</span><h3>{selected.label}</h3><p>{selected.kind === "doctor" ? selected.clinic : `${accountInvoices.length} invoice${accountInvoices.length === 1 ? "" : "s"} across the clinic`}</p></div><div><small>Outstanding</small><strong>{money(outstanding)}</strong></div></header>
        <section className="accounting-doctors-section"><header><div><ReceiptText size={17} /><span><h3>Invoices</h3><p>All billing linked to this account</p></span></div><strong>{accountInvoices.length}</strong></header><div className="finance-table-scroll"><table className="finance-table accounting-doctors-invoice-table"><thead><tr><th>Invoice</th><th>Case no.</th><th>Patient</th><th>Issued</th><th>Due</th><th>Status</th><th>Balance</th></tr></thead><tbody>{invoicePagination.pageItems.map((invoice) => <tr key={invoice.id} className="accounting-doctors-row" onClick={() => onViewInvoice(invoice)}><td><button className="table-link" type="button" onClick={() => onViewInvoice(invoice)}>{invoice.id}</button><small title={invoice.service}>{invoice.service}</small></td><td>{invoice.caseId ? <button className="table-link accounting-doctors-case-link" type="button" onClick={(event) => { event.stopPropagation(); onOpenCase(invoice.caseId!); }}>{invoice.caseNumber?.replace(/^ORA-/i, "") ?? "-"}</button> : "-"}</td><td><strong>{invoice.patient}</strong><small>{invoice.client}</small></td><td>{dateLabel(invoice.issued)}</td><td>{dateLabel(invoice.due)}</td><td><InvoiceStatus status={invoice.status} /></td><td><strong>{money(invoice.amount - invoice.paid)}</strong><small>of {money(invoice.amount)}</small></td></tr>)}{!accountInvoices.length && <tr><td colSpan={7} className="accounting-doctors-empty">No invoices are recorded for this account.</td></tr>}</tbody></table></div><TablePagination {...invoicePagination} /></section>
        <section className="accounting-doctors-section"><header><div><Banknote size={17} /><span><h3>Payments</h3><p>Recorded payment activity</p></span></div><strong>{accountPayments.length}</strong></header><div className="finance-table-scroll"><table className="finance-table accounting-doctors-payments-table"><thead><tr><th>Date</th><th>Reference</th><th>Invoice</th><th>Method</th><th>Deposited to</th><th>Amount</th></tr></thead><tbody>{paymentPagination.pageItems.map((item) => <tr key={item.id} className="accounting-doctors-row" onClick={() => setPayment(item)}><td>{dateLabel(item.date)}</td><td><strong>{item.reference}</strong><small>{item.receivedBy}</small></td><td>{item.invoice.id}<small>{item.invoice.patient}</small></td><td><span className={`accounting-doctors-method ${item.method.toLowerCase() === "cash" ? "cash" : "bank"}`}>{item.method.toLowerCase() === "cash" ? <Banknote size={13} /> : <Landmark size={13} />}{item.method}</span></td><td>{item.account}</td><td className="accounting-doctors-amount">{money(item.amount)}</td></tr>)}{!accountPayments.length && <tr><td colSpan={6} className="accounting-doctors-empty">No payments are recorded for this account.</td></tr>}</tbody></table></div><TablePagination {...paymentPagination} /></section>
      </> : <div className="accounting-doctors-empty-state"><UsersIcon /><p>Select a doctor or clinic to review its accounting activity.</p></div>}</div>
    </div>
    {statementOpen && selected && <StatementModal target={selected} invoices={accountInvoices} payments={accountPayments} onClose={() => setStatementOpen(false)} />}
    {payment && <PaymentDetails payment={payment} onClose={() => setPayment(null)} />}
  </div>;
}

function UsersIcon() { return <Stethoscope size={24} />; }
