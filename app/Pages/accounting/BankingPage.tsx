"use client";

import { ArrowLeft, ChevronRight, Landmark, Pencil, Plus, Printer, ReceiptText, Trash2, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import Modal from "../../Components/Modal";
import TablePagination, { useTablePagination } from "../../Components/TablePagination";
import { takeQueuedLedgerEntries } from "../../Components/accountingLedger";
import { ACCOUNTING_CURRENCIES, currencyLabel, formatCurrency, type AccountingCurrency, type CurrencySettings } from "../../Components/accountingCurrency";
import useDemoState from "../../Components/useDemoState";
import "../../Style/AccountingBanking.css";

type AccountId = string;
type TransactionStatus = "Cleared" | "Pending" | "Reconciled";
type TransactionDirection = "in" | "out";
type TransactionAction = { id: string; label: string; direction: TransactionDirection; requiresAccount?: boolean };

type LedgerTransaction = {
  id: string;
  date: string;
  reference: string;
  type: string;
  status: TransactionStatus;
  deposit?: number;
  withdrawal?: number;
  runningBalance: number;
  category: string;
  contact: string;
  method: string;
  memo: string;
  enteredBy: string;
};

type BankAccount = {
  id: AccountId;
  name: string;
  description: string;
  balance: number;
  currency: AccountingCurrency;
  icon: typeof WalletCards;
  transactions: LedgerTransaction[];
};

type CasePaymentForSync = {
  id: string;
  date: string;
  amount: number;
  method?: string;
  reference?: string;
  account?: string;
  currency?: AccountingCurrency;
  sourceAmount?: number;
  exchangeRate?: number;
  note?: string;
  doctorName: string;
};

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
const formatLedgerDate = (value: string) => { const date = new Date(`${value.slice(0, 10)}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date); };
const accountCurrencyLabel = (currency: AccountingCurrency) => currency === "USD" ? "US$" : currency === "SYP" ? "SYP" : "EUR";

const moneyOutActions: TransactionAction[] = [
  { id: "expense", label: "Expense", direction: "out" }, { id: "transfer-out", label: "Transfer To Another Account", direction: "out", requiresAccount: true }, { id: "sales-return", label: "Sales Return", direction: "out" }, { id: "card-payment", label: "Card Payment", direction: "out" }, { id: "owner-drawings", label: "Owner Drawings", direction: "out" }, { id: "deposit-out", label: "Deposit To Other Accounts", direction: "out", requiresAccount: true }, { id: "credit-note-refund", label: "Credit Note Refund", direction: "out" }, { id: "payment-refund", label: "Payment Refund", direction: "out" }, { id: "employee-reimbursement", label: "Employee Reimbursement", direction: "out" },
];
const moneyInActions: TransactionAction[] = [
  { id: "customer-advance", label: "Customer Advance", direction: "in" }, { id: "customer-payment", label: "Customer Payment", direction: "in" }, { id: "sales-without-invoice", label: "Sales Without Invoices", direction: "in" }, { id: "transfer-in", label: "Transfer From Another Account", direction: "in", requiresAccount: true }, { id: "interest-income", label: "Interest Income", direction: "in" }, { id: "other-income", label: "Other Income", direction: "in" }, { id: "expense-refund", label: "Expense Refund", direction: "in" }, { id: "deposit-in", label: "Deposit From Other Accounts", direction: "in", requiresAccount: true }, { id: "owner-contribution", label: "Owner's Contribution", direction: "in" },
];

const accounts: BankAccount[] = [
  {
    id: "petty-cash",
    name: "Petty Cash",
    description: "Cash held at the lab",
    balance: 385,
    currency: "USD",
    icon: WalletCards,
    transactions: [
      { id: "pc-4", date: "11 Aug 2026", reference: "PC-044", type: "Cash expense - courier", status: "Cleared", withdrawal: 18.5, runningBalance: 385, category: "Courier & delivery", contact: "Ora courier desk", method: "Cash", memo: "Same-day collection from Haddad Dental Center.", enteredBy: "Hassan" },
      { id: "pc-3", date: "09 Aug 2026", reference: "PC-043", type: "Cash expense - supplies", status: "Cleared", withdrawal: 32, runningBalance: 403.5, category: "Lab supplies", contact: "Local supplier", method: "Cash", memo: "Emergency burs and polishing supplies.", enteredBy: "Hassan" },
      { id: "pc-2", date: "05 Aug 2026", reference: "TRF-112", type: "Cash top-up", status: "Reconciled", deposit: 250, runningBalance: 435.5, category: "Internal transfer", contact: "In Bank Account", method: "Cash withdrawal", memo: "Weekly petty cash top-up.", enteredBy: "Hassan" },
      { id: "pc-1", date: "01 Aug 2026", reference: "OPEN-0801", type: "Opening balance", status: "Reconciled", deposit: 185.5, runningBalance: 185.5, category: "Opening balances", contact: "Ora Dental Lab", method: "Journal entry", memo: "Opening petty cash balance for August.", enteredBy: "Hassan" },
    ],
  },
  {
    id: "undeposited-funds",
    name: "Undeposited Funds",
    description: "Payments waiting to reach the bank",
    balance: 760,
    currency: "USD",
    icon: ReceiptText,
    transactions: [
      { id: "uf-4", date: "11 Aug 2026", reference: "RCPT-279", type: "Invoice payment - Dr. Rami Haddad", status: "Pending", deposit: 180, runningBalance: 760, category: "Client payment", contact: "Dr. Rami Haddad", method: "Cash", memo: "Payment received for INV-1051.", enteredBy: "Hassan" },
      { id: "uf-3", date: "10 Aug 2026", reference: "RCPT-278", type: "Invoice payment - Dr. Layla Mansour", status: "Pending", deposit: 250, runningBalance: 580, category: "Client payment", contact: "Dr. Layla Mansour", method: "Cheque", memo: "Cheque received, pending bank deposit.", enteredBy: "Hassan" },
      { id: "uf-2", date: "08 Aug 2026", reference: "DEP-087", type: "Bank deposit", status: "Cleared", withdrawal: 140, runningBalance: 330, category: "Bank deposit", contact: "In Bank Account", method: "Bank deposit", memo: "Deposited payments received during the first week of August.", enteredBy: "Hassan" },
      { id: "uf-1", date: "07 Aug 2026", reference: "RCPT-276", type: "Invoice payment - Dr. Ahmad Saleh", status: "Reconciled", deposit: 220, runningBalance: 470, category: "Client payment", contact: "Dr. Ahmad Saleh", method: "Cash", memo: "Payment received for completed zirconia crowns.", enteredBy: "Hassan" },
    ],
  },
  {
    id: "bank",
    name: "In Bank Account",
    description: "Primary operating account",
    balance: 5435,
    currency: "USD",
    icon: Landmark,
    transactions: [
      { id: "ba-5", date: "11 Aug 2026", reference: "DEP-088", type: "Deposit from undeposited funds", status: "Pending", deposit: 420, runningBalance: 5435, category: "Bank deposit", contact: "Undeposited Funds", method: "Bank deposit", memo: "Batch deposit for recent doctor payments.", enteredBy: "Hassan" },
      { id: "ba-4", date: "10 Aug 2026", reference: "BILL-842", type: "Supplier payment - Dental Mill Supply", status: "Cleared", withdrawal: 420, runningBalance: 5015, category: "Materials", contact: "Dental Mill Supply", method: "Bank transfer", memo: "Zirconia discs restock.", enteredBy: "Hassan" },
      { id: "ba-3", date: "08 Aug 2026", reference: "INV-1050", type: "Invoice payment - Dr. Layla Mansour", status: "Reconciled", deposit: 80, runningBalance: 5435, category: "Client payment", contact: "Dr. Layla Mansour", method: "Bank transfer", memo: "Partial payment for INV-1050.", enteredBy: "Hassan" },
      { id: "ba-2", date: "06 Aug 2026", reference: "EXP-041", type: "Lab utilities", status: "Reconciled", withdrawal: 31, runningBalance: 5355, category: "Utilities", contact: "Damascus Electricity Company", method: "Bank transfer", memo: "August laboratory utility payment.", enteredBy: "Hassan" },
      { id: "ba-1", date: "01 Aug 2026", reference: "OPEN-0801", type: "Opening balance", status: "Reconciled", deposit: 5306, runningBalance: 5386, category: "Opening balances", contact: "Ora Dental Lab", method: "Journal entry", memo: "Opening operating balance for August.", enteredBy: "Hassan" },
    ],
  },
];

function StatusBadge({ status }: { status: TransactionStatus }) {
  const tone = status === "Reconciled" ? "reconciled" : status === "Pending" ? "pending" : "cleared";
  return <span className={`banking-status ${tone}`}>{status}</span>;
}

function activateOnKeyboard(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function printTransaction(account: BankAccount, transaction: LedgerTransaction) {
  const printWindow = window.open("", "_blank", "width=760,height=820");
  if (!printWindow) return;
  const amount = transaction.deposit ?? transaction.withdrawal ?? 0;
  const direction = transaction.deposit ? "Deposit" : "Withdrawal";
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(transaction.reference)} | Ora</title><style>*{box-sizing:border-box}body{margin:0;padding:38px;color:#17211f;font-family:Arial,sans-serif;font-size:12px}.head{display:flex;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:2px solid #15695f}.brand{font-size:27px;font-weight:800;color:#15695f}.brand small{display:block;margin-top:3px;color:#65726f;font-size:10px;letter-spacing:1px;text-transform:uppercase}.title{text-align:right}.title h1{margin:0;font-size:20px}.title p{margin:6px 0 0;color:#65726f}.amount{margin:22px 0;padding:16px;border:1px solid #bddbd4;background:#edf7f4}.amount small,.details small{display:block;color:#65726f;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}.amount strong{display:block;margin-top:7px;color:#15695f;font-size:25px}.details{display:grid;grid-template-columns:1fr 1fr;gap:10px}.details div{min-height:58px;padding:11px;border:1px solid #dce4e1}.details strong{display:block;margin-top:5px;font-size:12px}.memo{margin-top:10px;padding:12px;border:1px solid #dce4e1;background:#f8fbfa}.memo p{margin:6px 0 0;line-height:1.5}@media print{body{padding:0}@page{margin:18mm}}</style></head><body><header class="head"><div class="brand">Ora<small>Dental Laboratory</small></div><div class="title"><h1>Bank transaction</h1><p>${escapeHtml(transaction.reference)}</p></div></header><section class="amount"><small>${direction}</small><strong>${escapeHtml(formatCurrency(amount, account.currency))}</strong></section><section class="details"><div><small>Account</small><strong>${escapeHtml(account.name)}</strong></div><div><small>Date</small><strong>${escapeHtml(transaction.date)}</strong></div><div><small>Type</small><strong>${escapeHtml(transaction.type)}</strong></div><div><small>Status</small><strong>${escapeHtml(transaction.status)}</strong></div><div><small>Category</small><strong>${escapeHtml(transaction.category)}</strong></div><div><small>Contact</small><strong>${escapeHtml(transaction.contact)}</strong></div><div><small>Payment method</small><strong>${escapeHtml(transaction.method)}</strong></div><div><small>Balance after transaction</small><strong>${escapeHtml(formatCurrency(transaction.runningBalance, account.currency))}</strong></div><div><small>Entered by</small><strong>${escapeHtml(transaction.enteredBy)}</strong></div></section><section class="memo"><small>Memo</small><p>${escapeHtml(transaction.memo || "No additional note.")}</p></section><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  printWindow.document.close();
}

function recalculateBalances(account: BankAccount) {
  let balance = account.balance;
  return {
    ...account,
    transactions: account.transactions.map((transaction) => {
      const withBalance = { ...transaction, runningBalance: balance };
      balance = balance - (transaction.deposit ?? 0) + (transaction.withdrawal ?? 0);
      return withBalance;
    }),
  };
}

function TransactionDrawer({ account, transaction, editing, onClose, onEdit, onPrint, onDelete, onSave }: { account: BankAccount; transaction: LedgerTransaction; editing: boolean; onClose: () => void; onEdit: () => void; onPrint: () => void; onDelete: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="banking-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="banking-transaction-drawer" role="dialog" aria-modal="true" aria-label={`Transaction ${transaction.reference}`}>
      <header className="banking-drawer-header"><div><span>{account.name}</span><h2>{transaction.reference}</h2><p>{transaction.type}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close transaction details" title="Close"><X size={18} /></button></header>
      <div className="banking-drawer-body">
        {editing ? <form className="banking-transaction-form" onSubmit={onSave}>
          <label className="field"><span>Date</span><input name="date" defaultValue={transaction.date} required /></label>
          <label className="field"><span>Reference</span><input name="reference" defaultValue={transaction.reference} required /></label>
          <label className="field span-2"><span>Type</span><input name="type" defaultValue={transaction.type} required /></label>
          <label className="field"><span>Status</span><select name="status" defaultValue={transaction.status}><option>Pending</option><option>Cleared</option><option>Reconciled</option></select></label>
          <label className="field"><span>Category</span><input name="category" defaultValue={transaction.category} required /></label>
          <label className="field"><span>Deposit</span><input name="deposit" type="number" min="0" step="0.01" defaultValue={transaction.deposit ?? ""} /></label>
          <label className="field"><span>Withdrawal</span><input name="withdrawal" type="number" min="0" step="0.01" defaultValue={transaction.withdrawal ?? ""} /></label>
          <label className="field"><span>Contact</span><input name="contact" defaultValue={transaction.contact} /></label>
          <label className="field"><span>Payment method</span><input name="method" defaultValue={transaction.method} /></label>
          <label className="field span-2"><span>Memo</span><textarea name="memo" defaultValue={transaction.memo} rows={3} /></label>
          <div className="banking-drawer-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save changes</button></div>
        </form> : <>
          <section className="banking-transaction-amount"><small>{transaction.deposit ? "Deposit" : "Withdrawal"}</small><strong className={transaction.deposit ? "deposit" : "withdrawal"}>{transaction.deposit ? "+" : "-"}{formatCurrency(transaction.deposit ?? transaction.withdrawal ?? 0, account.currency)}</strong><StatusBadge status={transaction.status} /></section>
          <section className="banking-detail-grid"><div><small>Date</small><strong>{transaction.date}</strong></div><div><small>Reference</small><strong>{transaction.reference}</strong></div><div><small>Type</small><strong>{transaction.type}</strong></div><div><small>Category</small><strong>{transaction.category}</strong></div><div><small>Contact</small><strong>{transaction.contact}</strong></div><div><small>Payment method</small><strong>{transaction.method}</strong></div><div><small>Deposits</small><strong className="deposit">{transaction.deposit ? formatCurrency(transaction.deposit, account.currency) : "-"}</strong></div><div><small>Withdrawals</small><strong className="withdrawal">{transaction.withdrawal ? formatCurrency(transaction.withdrawal, account.currency) : "-"}</strong></div><div className="span-2"><small>Running balance</small><strong>{formatCurrency(transaction.runningBalance, account.currency)}</strong></div></section>
          <section className="banking-drawer-note"><small>Memo</small><p>{transaction.memo || "No additional note."}</p><span>Entered by {transaction.enteredBy}</span></section>
          <div className="banking-drawer-actions"><button className="secondary-button" type="button" onClick={onEdit}><Pencil size={16} />Edit</button><button className="secondary-button" type="button" onClick={onPrint}><Printer size={16} />Print</button><button className="danger-button" type="button" onClick={onDelete}><Trash2 size={16} />Delete</button></div>
        </>}
      </div>
    </aside>
  </div>;
}

function TransactionActionPicker({ account, onClose, onSelect }: { account: BankAccount; onClose: () => void; onSelect: (action: TransactionAction) => void }) {
  const renderAction = (action: TransactionAction) => <button className="banking-action-option" type="button" key={action.id} onClick={() => onSelect(action)}><span className={action.direction}>{action.direction === "in" ? "IN" : "OUT"}</span><strong>{action.label}</strong><ChevronRight size={16} /></button>;
  return <div className="banking-action-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="banking-action-drawer" role="dialog" aria-modal="true" aria-label={`Add transaction to ${account.name}`}><header className="banking-drawer-header"><div><span>{account.name}</span><h2>Add transaction</h2><p>Choose the type of money movement to record.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close transaction actions" title="Close"><X size={18} /></button></header><div className="banking-action-body"><section><div className="banking-action-group-head"><span className="out">Money out</span><p>Record money leaving this account.</p></div><div className="banking-action-list">{moneyOutActions.map(renderAction)}</div></section><section><div className="banking-action-group-head"><span className="in">Money in</span><p>Record money arriving in this account.</p></div><div className="banking-action-list">{moneyInActions.map(renderAction)}</div></section></div></aside></div>;
}

function NewTransactionDrawer({ account, accounts, action, currencySettings, onBack, onClose, onSave }: { account: BankAccount; accounts: BankAccount[]; action: TransactionAction; currencySettings: CurrencySettings; onBack: () => void; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const otherAccounts = accounts.filter((item) => item.id !== account.id);
  const accountLabel = action.direction === "in" ? "Received from" : "Paid to";
  const isAccountDeposit = action.id === "deposit-in" || action.id === "deposit-out";
  const otherAccountLabel = isAccountDeposit ? action.direction === "in" ? "Deposit from account" : "Deposit to account" : action.direction === "in" ? "Transfer from account" : "Transfer to account";
  const [otherAccountId, setOtherAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceRate, setSourceRate] = useState(String(currencySettings.ratesToUsd[account.currency] ?? 1));
  const [targetRate, setTargetRate] = useState("1");
  const otherAccount = otherAccounts.find((item) => item.id === otherAccountId);
  const sourceAccount = action.direction === "out" ? account : otherAccount;
  const destinationAccount = action.direction === "out" ? otherAccount : account;
  const currenciesDiffer = Boolean(sourceAccount && destinationAccount && sourceAccount.currency !== destinationAccount.currency);
  const sourceAmount = Number(amount);
  const usdBridgeAmount = Number.isFinite(sourceAmount) && Number(sourceRate) > 0 ? sourceAmount * Number(sourceRate) : 0;
  const destinationAmount = currenciesDiffer && Number(targetRate) > 0 ? usdBridgeAmount * Number(targetRate) : sourceAmount;

  function chooseOtherAccount(id: string) {
    const nextOther = otherAccounts.find((item) => item.id === id);
    const nextSource = action.direction === "out" ? account : nextOther;
    const nextDestination = action.direction === "out" ? nextOther : account;
    setOtherAccountId(id);
    if (nextSource) setSourceRate(String(currencySettings.ratesToUsd[nextSource.currency] ?? 1));
    if (nextDestination) setTargetRate(String(1 / (currencySettings.ratesToUsd[nextDestination.currency] ?? 1)));
  }

  return <div className="banking-action-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="banking-action-drawer" role="dialog" aria-modal="true" aria-label={action.label}><header className="banking-drawer-header"><div><span>{action.direction === "in" ? "Money in" : "Money out"}</span><h2>{action.label}</h2><p>{account.name}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close new transaction" title="Close"><X size={18} /></button></header><form className="banking-new-transaction-form" onSubmit={onSave}><button className="banking-back-link" type="button" onClick={onBack}><ArrowLeft size={15} />All transaction actions</button><section className="banking-new-transaction-summary"><small>{action.direction === "in" ? "Money entering" : "Money leaving"}</small><strong>{account.name}</strong></section><label className="field"><span>Date</span><input name="date" type="date" defaultValue="2026-08-12" required /></label><label className="field"><span>{action.requiresAccount && sourceAccount ? `Amount moving (${accountCurrencyLabel(sourceAccount.currency)})` : "Amount"}</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>{!isAccountDeposit && <label className="field"><span>{accountLabel}</span><input name="contact" placeholder={action.direction === "in" ? "Customer, account, or source" : "Supplier, person, or destination"} required /></label>}<label className="field"><span>Reference</span><input name="reference" defaultValue="TXN-001" required /></label>{action.requiresAccount && <label className="field span-2"><span>{otherAccountLabel}</span><select name="otherAccount" value={otherAccountId} onChange={(event) => chooseOtherAccount(event.target.value)} required><option value="">Choose account</option>{otherAccounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {accountCurrencyLabel(item.currency)}</option>)}</select></label>}{currenciesDiffer && sourceAccount && destinationAccount && <section className="banking-exchange-calculator"><div className="banking-exchange-heading"><span>Currency exchange</span><small>{sourceAccount.name} to {destinationAccount.name}</small></div><label className="field"><span>1 {accountCurrencyLabel(sourceAccount.currency)} equals US$</span><input name="sourceRate" type="number" min="0.000001" step="0.000001" value={sourceRate} onChange={(event) => setSourceRate(event.target.value)} required /></label><label className="field"><span>1 US$ equals {accountCurrencyLabel(destinationAccount.currency)}</span><input name="targetRate" type="number" min="0.000001" step="0.000001" value={targetRate} onChange={(event) => setTargetRate(event.target.value)} required /></label><div className="banking-exchange-result"><small>USD bridge amount</small><strong>US${usdBridgeAmount.toFixed(2)}</strong><span>{Number.isFinite(destinationAmount) ? `${destinationAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${accountCurrencyLabel(destinationAccount.currency)} received` : "Enter a valid exchange rate"}</span></div><input name="targetAmount" type="hidden" value={Number.isFinite(destinationAmount) ? destinationAmount : 0} readOnly /></section>}<label className="field"><span>Payment method</span><select name="method" defaultValue={account.id === "petty-cash" ? "Cash" : "Bank transfer"}><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Cheque</option></select></label><label className="field"><span>Status</span><select name="status" defaultValue="Pending"><option>Pending</option><option>Cleared</option></select></label><label className="field span-2"><span>Notes</span><textarea name="memo" rows={3} placeholder="Optional transaction note" /></label><div className="banking-new-transaction-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} />Save transaction</button></div></form></aside></div>;
}

function NewBankAccountModal({ defaultCurrency, onClose, onSave }: { defaultCurrency: AccountingCurrency; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Add bank account" subtitle="Create an account to track its balance, transactions, and transfers." onClose={onClose}>
    <form className="banking-new-account-form" onSubmit={onSave}>
      <label className="field"><span>Account name</span><input name="name" placeholder="e.g. Cham Bank operating account" required autoFocus /></label>
      <label className="field"><span>Account number</span><input name="accountNumber" placeholder="Optional last four digits or reference" /></label>
      <label className="field"><span>Opening balance</span><input name="balance" type="number" min="0" step="0.01" defaultValue="0" required /></label>
      <label className="field"><span>Account currency</span><select name="currency" defaultValue={defaultCurrency}>{ACCOUNTING_CURRENCIES.map((currency) => <option value={currency} key={currency}>{currencyLabel(currency)}</option>)}</select></label>
      <label className="field"><span>Opening balance date</span><input name="openingDate" type="date" defaultValue="2026-08-15" required /></label>
      <label className="field span-2"><span>Description</span><textarea name="description" rows={3} placeholder="What this account is used for" /></label>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} />Add account</button></div>
    </form>
  </Modal>;
}

export default function BankingPage({ currencySettings, casePayments }: { currencySettings: CurrencySettings; casePayments: CasePaymentForSync[] }) {
  const [storedAccounts, setLedgerAccounts, ledgerReady] = useDemoState<BankAccount[]>(accounts);
  useEffect(() => {
    if (!ledgerReady) return;
    setLedgerAccounts((current) => {
      if (current.every((account) => account.currency)) return current;
      return current.map((account) => ({ ...account, currency: account.currency ?? "USD" }));
    });
  }, [ledgerReady, setLedgerAccounts]);
  const ledgerAccounts = storedAccounts.map((account) => ({
    ...account,
    currency: account.currency ?? "USD",
    icon: account.id === "petty-cash" ? WalletCards : account.id === "undeposited-funds" ? ReceiptText : Landmark,
  }));
  const [selectedAccountId, setSelectedAccountId] = useState<AccountId | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [transactionActionPickerOpen, setTransactionActionPickerOpen] = useState(false);
  const [newTransactionAction, setNewTransactionAction] = useState<TransactionAction | null>(null);
  const [nextTransactionSequence, setNextTransactionSequence] = useState(1);
  const [newBankAccountOpen, setNewBankAccountOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);
  const selectedAccount = ledgerAccounts.find((account) => account.id === selectedAccountId) ?? null;
  const selectedTransaction = selectedAccount?.transactions.find((transaction) => transaction.id === selectedTransactionId) ?? null;
  const accountPagination = useTablePagination(ledgerAccounts, ledgerAccounts.length);
  const transactionPagination = useTablePagination(selectedAccount?.transactions ?? [], selectedAccountId ?? "");

  const postQueuedEntries = useCallback(() => {
    const queued = takeQueuedLedgerEntries();
    if (!queued.length) return;
    setLedgerAccounts((current) => queued.reduce((allAccounts, entry) => allAccounts.map((account) => {
      const target = allAccounts.find((item) => item.name === entry.account) ?? allAccounts.find((item) => item.id === "bank");
      if (account.id !== target?.id || account.transactions.some((transaction) => transaction.id === entry.id)) return account;
      const isDeposit = entry.direction === "in";
      const ledgerAmount = entry.currency === "SYP" ? entry.sourceAmount ?? entry.amount : entry.amount;
      const balance = account.balance + (isDeposit ? ledgerAmount : -ledgerAmount);
      const transaction: LedgerTransaction = { id: entry.id, date: formatLedgerDate(entry.date), reference: entry.reference, type: entry.type, status: "Cleared", deposit: isDeposit ? ledgerAmount : undefined, withdrawal: isDeposit ? undefined : ledgerAmount, runningBalance: balance, category: entry.category, contact: entry.contact, method: entry.method, memo: entry.memo, enteredBy: "Hassan" };
      return recalculateBalances({ ...account, balance, transactions: [transaction, ...account.transactions] });
    }), current));
  }, [setLedgerAccounts]);

  useEffect(() => {
    if (!ledgerReady) return;
    postQueuedEntries();
    window.addEventListener("ora-ledger-entry", postQueuedEntries);
    return () => window.removeEventListener("ora-ledger-entry", postQueuedEntries);
  }, [ledgerReady, postQueuedEntries]);

  function syncCasePayments() {
    let added = 0;
    setLedgerAccounts((current) => casePayments.reduce((allAccounts, payment) => {
      if (!Number.isFinite(payment.amount) || Math.abs(payment.amount) < 0.001) return allAccounts;
      const ledgerId = `case-payment-${payment.id}`;
      if (allAccounts.some((account) => account.transactions.some((transaction) => transaction.id === ledgerId))) return allAccounts;
      const accountName = payment.account || (payment.method === "Bank" || payment.method === "Bank transfer" ? "In Bank Account" : "Undeposited Funds");
      const target = allAccounts.find((account) => account.name === accountName && (!payment.currency || account.currency === payment.currency)) ?? allAccounts.find((account) => account.name === accountName);
      const isDeposit = payment.amount > 0;
      const ledgerAmount = Math.abs(payment.currency === "SYP" ? payment.sourceAmount ?? payment.amount : payment.amount);
      if (!target) return allAccounts;
      added += 1;
      const transaction: LedgerTransaction = { id: ledgerId, date: formatLedgerDate(payment.date), reference: payment.reference || `PAY-${payment.id.slice(-5).toUpperCase()}`, type: isDeposit ? "Customer payment" : "Payment correction", status: "Cleared", deposit: isDeposit ? ledgerAmount : undefined, withdrawal: isDeposit ? undefined : ledgerAmount, runningBalance: target.balance + (isDeposit ? ledgerAmount : -ledgerAmount), category: "Accounts Receivable", contact: payment.doctorName, method: payment.method || "Cash", memo: payment.note || "Case payment", enteredBy: "Ora staff" };
      return allAccounts.map((account) => account.id !== target.id ? account : recalculateBalances({ ...account, balance: account.balance + (isDeposit ? ledgerAmount : -ledgerAmount), transactions: [transaction, ...account.transactions] }));
    }, current));
    setSyncSummary(added ? `${added} case payment${added === 1 ? "" : "s"} posted to banking.` : "All saved case payments are already in banking.");
  }

  function openAccount(accountId: AccountId) { setSelectedAccountId(accountId); setSelectedTransactionId(null); setEditingTransaction(false); setTransactionActionPickerOpen(false); setNewTransactionAction(null); }
  function openTransaction(transactionId: string) { setSelectedTransactionId(transactionId); setEditingTransaction(false); }
  function closeTransaction() { setSelectedTransactionId(null); setEditingTransaction(false); }
  function closeNewTransaction() { setTransactionActionPickerOpen(false); setNewTransactionAction(null); }
  function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount || !selectedTransaction) return;
    const form = new FormData(event.currentTarget);
    const depositValue = Number(form.get("deposit"));
    const withdrawalValue = Number(form.get("withdrawal"));
    const deposit = Number.isFinite(depositValue) && depositValue > 0 ? depositValue : undefined;
    const withdrawal = Number.isFinite(withdrawalValue) && withdrawalValue > 0 ? withdrawalValue : undefined;
    setLedgerAccounts((current) => current.map((account) => {
      if (account.id !== selectedAccount.id) return account;
      const balanceAdjustment = (deposit ?? 0) - (withdrawal ?? 0) - (selectedTransaction.deposit ?? 0) + (selectedTransaction.withdrawal ?? 0);
      return recalculateBalances({ ...account, balance: account.balance + balanceAdjustment, transactions: account.transactions.map((transaction) => transaction.id === selectedTransaction.id ? { ...transaction, date: String(form.get("date")), reference: String(form.get("reference")).trim(), type: String(form.get("type")).trim(), status: String(form.get("status")) as TransactionStatus, category: String(form.get("category")).trim(), deposit, withdrawal, contact: String(form.get("contact")).trim(), method: String(form.get("method")).trim(), memo: String(form.get("memo")).trim() } : transaction) });
    }));
    setEditingTransaction(false);
  }
  function deleteTransaction() {
    if (!selectedAccount || !selectedTransaction) return;
    setLedgerAccounts((current) => current.map((account) => account.id !== selectedAccount.id ? account : recalculateBalances({ ...account, balance: account.balance - (selectedTransaction.deposit ?? 0) + (selectedTransaction.withdrawal ?? 0), transactions: account.transactions.filter((transaction) => transaction.id !== selectedTransaction.id) })));
    setConfirmingDelete(false);
    closeTransaction();
  }
  function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount || !newTransactionAction) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const reference = String(form.get("reference")).trim();
    const enteredContact = String(form.get("contact") ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reference) return;
    const otherAccountId = String(form.get("otherAccount")) as AccountId;
    if (newTransactionAction.requiresAccount && !otherAccountId) return;
    const otherAccount = ledgerAccounts.find((account) => account.id === otherAccountId);
    const sourceAccount = newTransactionAction.direction === "out" ? selectedAccount : otherAccount;
    const destinationAccount = newTransactionAction.direction === "out" ? otherAccount : selectedAccount;
    const currenciesDiffer = Boolean(sourceAccount && destinationAccount && sourceAccount.currency !== destinationAccount.currency);
    const targetAmount = currenciesDiffer ? Number(form.get("targetAmount")) : amount;
    if (newTransactionAction.requiresAccount && (!Number.isFinite(targetAmount) || targetAmount <= 0)) return;
    const contact = enteredContact || otherAccount?.name || "Internal account";
    if (!newTransactionAction.requiresAccount && !contact) return;
    const date = formatLedgerDate(String(form.get("date")));
    const method = String(form.get("method"));
    const status = String(form.get("status")) as TransactionStatus;
    const memo = String(form.get("memo")).trim();
    const isMoneyIn = newTransactionAction.direction === "in";
    const newId = `txn-${nextTransactionSequence}`;
    const exchangeMemo = currenciesDiffer && sourceAccount && destinationAccount
      ? ` Converted ${formatCurrency(amount, sourceAccount.currency)} to ${formatCurrency(targetAmount, destinationAccount.currency)} using the entered exchange rates.`
      : "";
    setLedgerAccounts((current) => current.map((account) => {
      if (account.id === selectedAccount.id) {
        const selectedAmount = isMoneyIn ? targetAmount : amount;
        const transaction: LedgerTransaction = { id: newId, date, reference, type: newTransactionAction.label, status, deposit: isMoneyIn ? selectedAmount : undefined, withdrawal: isMoneyIn ? undefined : selectedAmount, runningBalance: account.balance + (isMoneyIn ? selectedAmount : -selectedAmount), category: newTransactionAction.label, contact, method, memo: `${memo}${exchangeMemo}`.trim(), enteredBy: "Hassan" };
        return recalculateBalances({ ...account, balance: account.balance + (isMoneyIn ? selectedAmount : -selectedAmount), transactions: [transaction, ...account.transactions] });
      }
      if (newTransactionAction.requiresAccount && account.id === otherAccountId) {
        const reciprocalIsMoneyIn = !isMoneyIn;
        const counterpartAmount = reciprocalIsMoneyIn ? targetAmount : amount;
        const transaction: LedgerTransaction = { id: `${newId}-counterpart`, date, reference, type: reciprocalIsMoneyIn ? `Transfer from ${selectedAccount.name}` : `Transfer to ${selectedAccount.name}`, status, deposit: reciprocalIsMoneyIn ? counterpartAmount : undefined, withdrawal: reciprocalIsMoneyIn ? undefined : counterpartAmount, runningBalance: account.balance + (reciprocalIsMoneyIn ? counterpartAmount : -counterpartAmount), category: "Internal transfer", contact: selectedAccount.name, method, memo: `${memo || `Linked to ${reference}.`}${exchangeMemo}`.trim(), enteredBy: "Hassan" };
        return recalculateBalances({ ...account, balance: account.balance + (reciprocalIsMoneyIn ? counterpartAmount : -counterpartAmount), transactions: [transaction, ...account.transactions] });
      }
      return account;
    }));
    setNextTransactionSequence((current) => current + 1);
    closeNewTransaction();
  }
  function createBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const accountNumber = String(form.get("accountNumber")).trim();
    const description = String(form.get("description")).trim();
    const currency = String(form.get("currency")) as AccountingCurrency;
    const balance = Math.max(0, Number(form.get("balance")) || 0);
    const openingDate = formatLedgerDate(String(form.get("openingDate")));
    if (!name) return;
    const id = `bank-${Date.now().toString(36)}`;
    const openingTransaction: LedgerTransaction[] = balance > 0 ? [{
      id: `${id}-opening`, date: openingDate, reference: `OPEN-${id.slice(-5).toUpperCase()}`, type: "Opening balance", status: "Cleared", deposit: balance, runningBalance: balance, category: "Opening balances", contact: "Ora Dental Lab", method: "Journal entry", memo: "Opening balance entered while creating this bank account.", enteredBy: "Hassan",
    }] : [];
    setLedgerAccounts((current) => [...current, {
      id,
      name,
      description: description || (accountNumber ? `Account ending ${accountNumber}` : "Bank account"),
      balance,
      currency,
      icon: Landmark,
      transactions: openingTransaction,
    }]);
    setNewBankAccountOpen(false);
  }

  if (selectedAccount) {
    const Icon = selectedAccount.icon;
    return <div className="banking-page">
      <header className="banking-heading"><div><span>Money</span><h2>{selectedAccount.name}</h2><p>{selectedAccount.description}</p></div><div className="banking-heading-actions"><button className="primary-button" type="button" onClick={() => { closeTransaction(); setTransactionActionPickerOpen(true); }}><Plus size={16} />Add transaction</button><button className="secondary-button banking-back-button" type="button" onClick={() => { closeTransaction(); closeNewTransaction(); setSelectedAccountId(null); }}><ArrowLeft size={16} />Active accounts</button></div></header>
      <section className="banking-ledger-summary" aria-label={`${selectedAccount.name} balance`}><span className="banking-account-icon"><Icon size={20} /></span><div><small>Current balance</small><strong>{formatCurrency(selectedAccount.balance, selectedAccount.currency)}</strong></div><p>{selectedAccount.transactions.length} recorded transactions in {accountCurrencyLabel(selectedAccount.currency)}</p></section>
      <section className="banking-ledger-card"><div className="banking-ledger-header"><div><h3>Transactions</h3><p>Select a transaction to inspect and manage its full record.</p></div></div><div className="finance-table-scroll"><table className="finance-table banking-transactions-table"><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Status</th><th>Deposits</th><th>Withdrawals</th><th>Running balance</th></tr></thead><tbody>{transactionPagination.pageItems.map((transaction) => <tr key={transaction.id} className="banking-clickable-row" role="button" tabIndex={0} aria-label={`Open transaction ${transaction.reference}`} onClick={() => openTransaction(transaction.id)} onKeyDown={(event) => activateOnKeyboard(event, () => openTransaction(transaction.id))}><td>{transaction.date}</td><td><strong>{transaction.reference}</strong></td><td>{transaction.type}</td><td><StatusBadge status={transaction.status} /></td><td className="banking-money deposit">{transaction.deposit ? formatCurrency(transaction.deposit, selectedAccount.currency) : "-"}</td><td className="banking-money withdrawal">{transaction.withdrawal ? formatCurrency(transaction.withdrawal, selectedAccount.currency) : "-"}</td><td className="banking-balance">{formatCurrency(transaction.runningBalance, selectedAccount.currency)}</td></tr>)}</tbody></table></div><TablePagination {...transactionPagination} /></section>
      {selectedTransaction && <TransactionDrawer account={selectedAccount} transaction={selectedTransaction} editing={editingTransaction} onClose={closeTransaction} onEdit={() => setEditingTransaction(true)} onPrint={() => printTransaction(selectedAccount, selectedTransaction)} onDelete={() => setConfirmingDelete(true)} onSave={saveTransaction} />}
      {!newTransactionAction && transactionActionPickerOpen && <TransactionActionPicker account={selectedAccount} onClose={closeNewTransaction} onSelect={(action) => setNewTransactionAction(action)} />}
      {newTransactionAction && <NewTransactionDrawer account={selectedAccount} accounts={ledgerAccounts} action={newTransactionAction} currencySettings={currencySettings} onBack={() => setNewTransactionAction(null)} onClose={closeNewTransaction} onSave={createTransaction} />}
      {confirmingDelete && selectedTransaction && <Modal title="Delete transaction?" subtitle={`${selectedTransaction.reference} will be permanently removed from ${selectedAccount.name}.`} onClose={() => setConfirmingDelete(false)}><div className="banking-delete-confirm"><p>This changes the account balance and removes the transaction from the ledger.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button><button className="danger-button" type="button" onClick={deleteTransaction}><Trash2 size={16} />Delete transaction</button></div></div></Modal>}
    </div>;
  }

  return <div className="banking-page">
    <header className="banking-heading"><div><span>Money</span><h2>Banking</h2><p>Review the accounts used for cash, deposits, and day-to-day banking. Base reporting currency: {currencySettings.baseCurrency}.</p>{syncSummary && <small className="banking-sync-summary">{syncSummary}</small>}</div><div className="banking-heading-actions"><button className="secondary-button" type="button" onClick={syncCasePayments}>Sync case payments</button><button className="primary-button" type="button" onClick={() => setNewBankAccountOpen(true)}><Plus size={16} />Add bank account</button></div></header>
    <section className="banking-accounts-card"><div className="banking-accounts-header"><div><h3>Active accounts</h3><p>Select an account to review its transaction history.</p></div><span>{ledgerAccounts.length} accounts</span></div><div className="banking-accounts-table-wrap"><table className="banking-accounts-table"><thead><tr><th>Account</th><th>Current balance</th><th aria-label="Open account" /></tr></thead><tbody>{accountPagination.pageItems.map((account) => { const Icon = account.icon; return <tr key={account.id} className="banking-clickable-row" role="button" tabIndex={0} aria-label={`Open ${account.name}`} onClick={() => openAccount(account.id)} onKeyDown={(event) => activateOnKeyboard(event, () => openAccount(account.id))}><td><span className="banking-account-cell"><span className="banking-account-icon"><Icon size={18} /></span><span><strong>{account.name}</strong><small>{account.description} · {accountCurrencyLabel(account.currency)}</small></span></span></td><td className="banking-account-balance">{formatCurrency(account.balance, account.currency)}</td><td><ChevronRight className="banking-row-chevron" size={18} aria-hidden="true" /></td></tr>; })}</tbody></table></div><TablePagination {...accountPagination} /></section>
    {newBankAccountOpen && <NewBankAccountModal defaultCurrency={currencySettings.baseCurrency} onClose={() => setNewBankAccountOpen(false)} onSave={createBankAccount} />}
  </div>;
}
