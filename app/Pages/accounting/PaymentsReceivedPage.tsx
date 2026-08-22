"use client";

import { ArrowLeft, Banknote, Landmark, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import Modal from "../../Components/Modal";
import TablePagination, { useTablePagination } from "../../Components/TablePagination";
import PaymentDepositFields, { type PaymentCurrency } from "../../Components/PaymentDepositFields";
import PaymentExchangeRateFields, { paymentAmountInUsd } from "../../Components/PaymentExchangeRateFields";
import "../../Style/AccountingPayments.css";

type PaymentSource = {
  id: string;
  client: string;
  amount: number;
  paid: number;
  payments: PaymentRecord[];
};

type PaymentRecord = { id: string; date: string; amount: number; method: string; reference: string; account: string; currency?: PaymentCurrency; sourceAmount?: number; exchangeRate?: number; note: string; receivedBy: string };
type PaymentMethod = "Cash" | "Bank";
type PaymentChange = Pick<PaymentRecord, "date" | "amount" | "method" | "reference" | "account" | "currency" | "sourceAmount" | "exchangeRate" | "note">;
type NewPayment = Pick<PaymentRecord, "date" | "amount" | "method" | "reference" | "account" | "currency" | "sourceAmount" | "exchangeRate" | "note">;
type PaymentRow = PaymentRecord & { invoiceId: string; customer: string; invoiceAmount: number; invoicePaid: number; paymentKind: PaymentMethod };

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const formatDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
const methodFor = (method: string): PaymentMethod => method.trim().toLowerCase() === "cash" ? "Cash" : "Bank";
const escapeHtml = (value: string | number) => {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (character) => entities[character] ?? character);
};

function activateOnKeyboard(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function printPayment(payment: PaymentRow) {
  const printWindow = window.open("", "_blank", "width=760,height=820");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(payment.reference)} | Ora</title><style>*{box-sizing:border-box}body{margin:0;padding:38px;color:#17211f;font-family:Arial,sans-serif;font-size:12px}.head{display:flex;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:2px solid #15695f}.brand{font-size:27px;font-weight:800;color:#15695f}.brand small{display:block;margin-top:3px;color:#65726f;font-size:10px;letter-spacing:1px;text-transform:uppercase}.title{text-align:right}.title h1{margin:0;font-size:20px}.title p{margin:6px 0 0;color:#65726f}.amount{margin:22px 0;padding:16px;border:1px solid #bddbd4;background:#edf7f4}.amount small,.details small,.note small{display:block;color:#65726f;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}.amount strong{display:block;margin-top:7px;color:#15695f;font-size:25px}.details{display:grid;grid-template-columns:1fr 1fr;gap:10px}.details div{min-height:58px;padding:11px;border:1px solid #dce4e1}.details strong{display:block;margin-top:5px;font-size:12px}.note{margin-top:10px;padding:12px;border:1px solid #dce4e1;background:#f8fbfa}.note p{margin:6px 0 0;line-height:1.5}@media print{body{padding:0}@page{margin:18mm}}</style></head><body><header class="head"><div class="brand">Ora<small>Dental Laboratory</small></div><div class="title"><h1>Payment receipt</h1><p>${escapeHtml(payment.reference)}</p></div></header><section class="amount"><small>Amount received</small><strong>${escapeHtml(formatCurrency(payment.amount))}</strong></section><section class="details"><div><small>Customer</small><strong>${escapeHtml(payment.customer)}</strong></div><div><small>Invoice</small><strong>${escapeHtml(payment.invoiceId)}</strong></div><div><small>Date received</small><strong>${escapeHtml(formatDate(payment.date))}</strong></div><div><small>Payment type</small><strong>${escapeHtml(payment.paymentKind)}</strong></div><div><small>Method</small><strong>${escapeHtml(payment.method)}</strong></div><div><small>Deposit account</small><strong>${escapeHtml(payment.account)}</strong></div><div><small>Recorded by</small><strong>${escapeHtml(payment.receivedBy)}</strong></div></section><section class="note"><small>Notes</small><p>${escapeHtml(payment.note || "No additional note.")}</p></section><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  printWindow.document.close();
}

function PaymentDrawer({ payment, editing, onClose, onEdit, onPrint, onDelete, onSave }: { payment: PaymentRow; editing: boolean; onClose: () => void; onEdit: () => void; onPrint: () => void; onDelete: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const maxAmount = Math.max(0, payment.invoiceAmount - (payment.invoicePaid - payment.amount));
  const [account, setAccount] = useState(payment.account);
  const [currency, setCurrency] = useState<PaymentCurrency>(payment.currency ?? "USD");
  const [amount, setAmount] = useState(String(payment.currency === "SYP" ? payment.sourceAmount ?? payment.amount : payment.amount));
  const [exchangeRate, setExchangeRate] = useState(String(payment.exchangeRate ?? 13000));
  const usdAmount = paymentAmountInUsd(amount, currency, exchangeRate);
  function changeCurrency(nextCurrency: PaymentCurrency) {
    if (nextCurrency === currency) return;
    const rate = Number(exchangeRate) || 13000;
    setAmount(nextCurrency === "SYP" ? String(Math.round(usdAmount * rate)) : usdAmount.toFixed(2));
    setCurrency(nextCurrency);
  }
  return <div className="payments-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="payments-drawer" role="dialog" aria-modal="true" aria-label={`Payment ${payment.reference}`}>
      <header className="payments-drawer-header"><div><span>{payment.customer}</span><h2>{payment.reference}</h2><p>{payment.invoiceId}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close payment details" title="Close"><X size={18} /></button></header>
      <div className="payments-drawer-body">
        {editing ? <form className="payments-edit-form" onSubmit={onSave}>
          <label className="field"><span>Date received</span><input name="date" type="date" defaultValue={payment.date.slice(0, 10)} required /></label>
          <label className="field"><span>Amount received{currency === "SYP" ? " (SYP)" : " (US$)"}</span><input name="amount" type="number" min="0.01" max={currency === "SYP" ? undefined : maxAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label className="field"><span>Payment method</span><select name="method" defaultValue={payment.method}><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Cheque</option></select></label>
          <PaymentDepositFields account={account} currency={currency} onAccountChange={setAccount} onCurrencyChange={changeCurrency} />
          <PaymentExchangeRateFields amount={amount} currency={currency} exchangeRate={exchangeRate} onExchangeRateChange={setExchangeRate} />
          <label className="field span-2"><span>Receipt reference</span><input name="reference" defaultValue={payment.reference} required /></label>
          <label className="field span-2"><span>Notes</span><textarea name="note" rows={3} defaultValue={payment.note} /></label>
          <div className="payments-drawer-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save changes</button></div>
        </form> : <>
          <section className="payments-drawer-amount"><small>Amount received</small><strong>{formatCurrency(payment.amount)}</strong><span className={`payments-method ${payment.paymentKind.toLowerCase()}`}>{payment.paymentKind === "Cash" ? <Banknote size={14} /> : <Landmark size={14} />}{payment.paymentKind}</span></section>
          <section className="payments-detail-grid"><div><small>Date received</small><strong>{formatDate(payment.date)}</strong></div><div><small>Invoice number</small><strong>{payment.invoiceId}</strong></div><div><small>Customer</small><strong>{payment.customer}</strong></div><div><small>Payment method</small><strong>{payment.method}</strong></div><div><small>Deposit account</small><strong>{payment.account}</strong></div><div><small>Receipt reference</small><strong>{payment.reference}</strong></div>{payment.currency === "SYP" && <><div><small>SYP collected</small><strong>{Number(payment.sourceAmount ?? 0).toLocaleString("en-US")} SYP</strong></div><div><small>Exchange rate</small><strong>{Number(payment.exchangeRate ?? 0).toLocaleString("en-US")} SYP / US$</strong></div></>}<div className="span-2"><small>Recorded by</small><strong>{payment.receivedBy}</strong></div></section>
          <section className="payments-drawer-note"><small>Notes</small><p>{payment.note || "No additional note."}</p></section>
          <div className="payments-drawer-actions"><button className="secondary-button" type="button" onClick={onEdit}><Pencil size={16} />Edit</button><button className="secondary-button" type="button" onClick={onPrint}><Printer size={16} />Print</button><button className="danger-button" type="button" onClick={onDelete}><Trash2 size={16} />Delete</button></div>
        </>}
      </div>
    </aside>
  </div>;
}

function NewPaymentPage({ invoices, onBack, onAddPayment }: { invoices: PaymentSource[]; onBack: () => void; onAddPayment: (customer: string, payment: NewPayment) => void }) {
  const customers = [...new Set(invoices.map((invoice) => invoice.client))].sort();
  const [customer, setCustomer] = useState(customers[0] ?? "");
  const [amount, setAmount] = useState("");
  const [receiveFullAmount, setReceiveFullAmount] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>("Cash");
  const [account, setAccount] = useState("Petty Cash");
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [exchangeRate, setExchangeRate] = useState("13000");
  const customerOutstanding = invoices.filter((invoice) => invoice.client === customer).reduce((sum, invoice) => sum + Math.max(0, invoice.amount - invoice.paid), 0);
  const canRecord = Boolean(customer) && customerOutstanding > 0;
  const usdAmount = paymentAmountInUsd(amount, currency, exchangeRate);

  function chooseCustomer(value: string) { setCustomer(value); setAmount(""); setReceiveFullAmount(false); }
  function chooseFullAmount() { setAmount(currency === "SYP" ? String(Math.round(customerOutstanding * (Number(exchangeRate) || 13000))) : customerOutstanding.toFixed(2)); setReceiveFullAmount(true); }
  function changeCurrency(nextCurrency: PaymentCurrency) {
    if (nextCurrency === currency) return;
    const rate = Number(exchangeRate) || 13000;
    setAmount(nextCurrency === "SYP" ? String(Math.round(usdAmount * rate)) : usdAmount.toFixed(2));
    setReceiveFullAmount(false);
    setCurrency(nextCurrency);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const receivedAmount = Number(form.get("amount"));
    const appliedAmount = Number(form.get("usdAmount") ?? receivedAmount);
    const paymentCurrency: PaymentCurrency = form.get("currency") === "SYP" ? "SYP" : "USD";
    if (!canRecord || !Number.isFinite(appliedAmount) || appliedAmount <= 0 || appliedAmount > customerOutstanding) return;
    onAddPayment(customer, { date: String(form.get("date")), amount: appliedAmount, method: paymentMode === "Cash" ? "Cash" : "Bank transfer", reference: String(form.get("reference")).trim(), account: String(form.get("account")), currency: paymentCurrency, sourceAmount: paymentCurrency === "SYP" ? receivedAmount : undefined, exchangeRate: paymentCurrency === "SYP" ? Number(form.get("exchangeRate")) : undefined, note: String(form.get("note")).trim() });
    onBack();
  }

  return <div className="payments-new-page">
    <header className="payments-received-heading"><div><span>Sales</span><h2>New payment</h2><p>Record a payment against a customer’s outstanding invoices.</p></div><button className="secondary-button" type="button" onClick={onBack}><ArrowLeft size={16} />Payments received</button></header>
    <form className="payments-new-form" onSubmit={submit}>
      <section className="payments-new-section"><h3>Customer and amount</h3><div className="payments-new-grid"><label className="field span-2"><span>Customer name</span><select value={customer} onChange={(event) => chooseCustomer(event.target.value)} required>{customers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label><div className="payments-outstanding"><small>Outstanding amount</small><strong>{formatCurrency(customerOutstanding)}</strong><span>Applied across open invoices automatically</span></div><label className="field"><span>Amount received{currency === "SYP" ? " (SYP)" : " (US$)"}</span><input name="amount" type="number" min="0.01" max={currency === "SYP" ? undefined : customerOutstanding || undefined} step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setReceiveFullAmount(paymentAmountInUsd(event.target.value, currency, exchangeRate) === customerOutstanding); }} placeholder="0.00" required disabled={!canRecord} /></label><button className={`payments-full-amount ${receiveFullAmount ? "active" : ""}`} type="button" onClick={chooseFullAmount} disabled={!canRecord}><span>Receive full amount</span><strong>{formatCurrency(customerOutstanding)}</strong></button></div></section>
      <section className="payments-new-section"><h3>Payment details</h3><div className="payments-new-grid"><label className="field"><span>Payment date</span><input name="date" type="date" defaultValue="2026-08-11" required /></label><label className="field"><span>Payment #</span><input name="reference" defaultValue="PAY-281" required /></label><div className="payments-mode-field"><span>Payment mode</span><div className="payments-mode-toggle"><button className={paymentMode === "Cash" ? "active" : ""} type="button" onClick={() => setPaymentMode("Cash")}><Banknote size={16} />Cash</button><button className={paymentMode === "Bank" ? "active" : ""} type="button" onClick={() => setPaymentMode("Bank")}><Landmark size={16} />Bank</button></div></div><PaymentDepositFields account={account} currency={currency} onAccountChange={setAccount} onCurrencyChange={changeCurrency} /><PaymentExchangeRateFields amount={amount} currency={currency} exchangeRate={exchangeRate} onExchangeRateChange={setExchangeRate} /><label className="field span-2"><span>Notes</span><textarea name="note" rows={3} placeholder="Optional payment note" /></label></div></section>
      <footer className="payments-new-actions"><button className="secondary-button" type="button" onClick={onBack}>Cancel</button><button className="primary-button" type="submit" disabled={!canRecord}><Plus size={16} />Record payment</button></footer>
    </form>
  </div>;
}

export default function PaymentsReceivedPage({ invoices, onUpdatePayment, onDeletePayment, onAddPayment }: { invoices: PaymentSource[]; onUpdatePayment: (invoiceId: string, paymentId: string, changes: PaymentChange) => void; onDeletePayment: (invoiceId: string, paymentId: string) => void; onAddPayment: (customer: string, payment: NewPayment) => void }) {
  const [filter, setFilter] = useState<"All" | PaymentMethod>("All");
  const [view, setView] = useState<"list" | "new">("list");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const payments = useMemo<PaymentRow[]>(() => invoices.flatMap((invoice) => invoice.payments.map((payment) => ({ ...payment, invoiceId: invoice.id, customer: invoice.client, invoiceAmount: invoice.amount, invoicePaid: invoice.paid, paymentKind: methodFor(payment.method) }))).sort((left, right) => right.date.localeCompare(left.date)), [invoices]);
  const visiblePayments = filter === "All" ? payments : payments.filter((payment) => payment.paymentKind === filter);
  const paymentPagination = useTablePagination(visiblePayments, filter);
  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId) ?? null;

  function closeDrawer() { setSelectedPaymentId(null); setEditing(false); }
  function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPayment) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("usdAmount") ?? form.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const currency: PaymentCurrency = form.get("currency") === "SYP" ? "SYP" : "USD";
    onUpdatePayment(selectedPayment.invoiceId, selectedPayment.id, { date: String(form.get("date")), amount, method: String(form.get("method")), reference: String(form.get("reference")).trim(), account: String(form.get("account")), currency, sourceAmount: currency === "SYP" ? Number(form.get("amount")) : undefined, exchangeRate: currency === "SYP" ? Number(form.get("exchangeRate")) : undefined, note: String(form.get("note")).trim() });
    setEditing(false);
  }
  function deletePayment() {
    if (!selectedPayment) return;
    onDeletePayment(selectedPayment.invoiceId, selectedPayment.id);
    setConfirmingDelete(false);
    closeDrawer();
  }

  if (view === "new") return <NewPaymentPage invoices={invoices} onBack={() => setView("list")} onAddPayment={onAddPayment} />;

  return <div className="payments-received-page">
    <header className="payments-received-heading"><div><span>Sales</span><h2>Payments Received</h2><p>Every payment received from dentists against Ora invoices.</p></div><button className="primary-button" type="button" onClick={() => setView("new")}><Plus size={16} />New payment</button></header>
    <section className="payments-received-card"><div className="payments-received-card-header"><div><h3>All Received Payments</h3><p>{visiblePayments.length} recorded payment{visiblePayments.length === 1 ? "" : "s"}</p></div><div className="payments-received-filter" aria-label="Payment method filter">{(["All", "Cash", "Bank"] as const).map((item) => <button className={filter === item ? "active" : ""} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="finance-table-scroll"><table className="finance-table payments-received-table"><thead><tr><th>Date</th><th>Customer</th><th>Invoice number</th><th>Amount</th><th>Method</th><th>Deposited to</th></tr></thead><tbody>{paymentPagination.pageItems.map((payment) => <tr key={payment.id} className="payments-clickable-row" role="button" tabIndex={0} aria-label={`Open payment ${payment.reference}`} onClick={() => { setSelectedPaymentId(payment.id); setEditing(false); }} onKeyDown={(event) => activateOnKeyboard(event, () => { setSelectedPaymentId(payment.id); setEditing(false); })}><td>{formatDate(payment.date)}</td><td><strong>{payment.customer}</strong></td><td><span className="payments-invoice-number">{payment.invoiceId}</span></td><td className="payments-amount">{formatCurrency(payment.amount)}</td><td><span className={`payments-method ${payment.paymentKind.toLowerCase()}`}>{payment.paymentKind === "Cash" ? <Banknote size={14} /> : <Landmark size={14} />}{payment.paymentKind}</span></td><td><span className="payments-deposit-account">{payment.account}</span></td></tr>)}{!visiblePayments.length && <tr><td className="payments-empty" colSpan={6}>No {filter.toLowerCase()} payments have been recorded yet.</td></tr>}</tbody></table></div><TablePagination {...paymentPagination} /></section>
    {selectedPayment && <PaymentDrawer payment={selectedPayment} editing={editing} onClose={closeDrawer} onEdit={() => setEditing(true)} onPrint={() => printPayment(selectedPayment)} onDelete={() => setConfirmingDelete(true)} onSave={savePayment} />}
    {confirmingDelete && selectedPayment && <Modal title="Delete payment?" subtitle={`${selectedPayment.reference} will be removed from ${selectedPayment.invoiceId}.`} onClose={() => setConfirmingDelete(false)}><div className="payments-delete-confirm"><p>This removes the payment from the invoice and updates its paid balance.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button><button className="danger-button" type="button" onClick={deletePayment}><Trash2 size={16} />Delete payment</button></div></div></Modal>}
  </div>;
}
