"use client";

import { ArrowDownRight, ArrowUpRight, Landmark, Plus, Scale, WalletCards, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import Modal from "../../Components/Modal";
import TablePagination, { useTablePagination } from "../../Components/TablePagination";
import useDemoState from "../../Components/useDemoState";
import "../../Style/AccountingChartOfAccounts.css";

type AccountTone = "asset" | "liability" | "equity" | "income" | "expense" | "cogs";
type AccountTransaction = { id: string; date: string; reference: string; description: string; debit?: number; credit?: number; balance: number };
const accountIcons = { asset: Landmark, liability: ArrowUpRight, equity: Scale, income: ArrowDownRight, expense: WalletCards, cogs: WalletCards };
const account = (code: string, name: string, type: string, group: string, tone: AccountTone, balance = "$0.00", description = "") => ({ code, name, type, group, tone, balance, description, icon: accountIcons[tone] });
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const accountTransactions: Record<string, AccountTransaction[]> = {
  "1000": [{ id: "bank-4", date: "11 Aug 2026", reference: "DEP-088", description: "Deposit from Undeposited Funds", debit: 420, balance: 5435 }, { id: "bank-3", date: "10 Aug 2026", reference: "BILL-842", description: "Supplier payment - Dental Mill Supply", credit: 420, balance: 5015 }, { id: "bank-2", date: "08 Aug 2026", reference: "INV-1050", description: "Invoice payment - Dr. Layla Mansour", debit: 80, balance: 5435 }, { id: "bank-1", date: "01 Aug 2026", reference: "OPEN-0801", description: "Opening balance", debit: 5306, balance: 5386 }],
  "1040": [{ id: "cash-3", date: "11 Aug 2026", reference: "PC-044", description: "Cash expense - courier", credit: 18.5, balance: 385 }, { id: "cash-2", date: "09 Aug 2026", reference: "PC-043", description: "Cash expense - supplies", credit: 32, balance: 403.5 }, { id: "cash-1", date: "05 Aug 2026", reference: "TRF-112", description: "Cash top-up from bank", debit: 250, balance: 435.5 }],
  "1050": [{ id: "fund-3", date: "11 Aug 2026", reference: "RCPT-279", description: "Payment received - Dr. Rami Haddad", debit: 180, balance: 760 }, { id: "fund-2", date: "10 Aug 2026", reference: "RCPT-278", description: "Payment received - Dr. Layla Mansour", debit: 250, balance: 580 }, { id: "fund-1", date: "08 Aug 2026", reference: "DEP-087", description: "Deposit to In Bank Account", credit: 140, balance: 330 }],
  "2040": [{ id: "ap-2", date: "10 Aug 2026", reference: "BILL-842", description: "Dental Mill Supply - zirconia discs", credit: 420, balance: 835 }, { id: "ap-1", date: "07 Aug 2026", reference: "BILL-841", description: "OralTech Services - resin supply", credit: 340, balance: 415 }],
  "4060": [{ id: "sales-3", date: "11 Aug 2026", reference: "INV-1053", description: "Zirconia crown case invoice", credit: 124, balance: 1392 }, { id: "sales-2", date: "10 Aug 2026", reference: "INV-1051", description: "Bridge case invoice", credit: 186, balance: 1268 }, { id: "sales-1", date: "04 Aug 2026", reference: "INV-1049", description: "Dental laboratory services", credit: 116, balance: 1082 }],
};

const initialAccounts = [
  account("1000", "In Bank Account", "Bank", "Assets", "asset", "$5,435.00"),
  account("1010", "Advance Tax", "Other Current Asset", "Assets", "asset"),
  account("1020", "Prepaid Expenses", "Other Current Asset", "Assets", "asset"),
  account("1030", "Employee Advance", "Other Current Asset", "Assets", "asset"),
  account("1040", "Petty Cash", "Cash", "Assets", "asset", "$385.00"),
  account("1050", "Undeposited Funds", "Cash", "Assets", "asset", "$760.00"),
  account("1060", "Accounts Receivable", "Accounts Receivable", "Assets", "asset"),
  account("1070", "Furniture and Equipment", "Fixed Asset", "Assets", "asset"),
  account("1080", "Inventory Asset", "Stock", "Assets", "asset"),
  account("2000", "Unearned Revenue", "Other Current Liability", "Liabilities", "liability"),
  account("2010", "Employee Reimbursements", "Other Current Liability", "Liabilities", "liability"),
  account("2020", "Opening Balance Adjustments", "Other Current Liability", "Liabilities", "liability"),
  account("2030", "Tax Payable", "Other Current Liability", "Liabilities", "liability"),
  account("2040", "Accounts Payable", "Accounts Payable", "Liabilities", "liability", "$835.00"),
  account("2050", "Dimension Adjustments", "Other Liability", "Liabilities", "liability"),
  account("3000", "Drawings", "Equity", "Equity", "equity"),
  account("3010", "Opening Balance Offset", "Equity", "Equity", "equity"),
  account("3020", "Owner's Equity", "Equity", "Equity", "equity"),
  account("3030", "Retained Earnings", "Equity", "Equity", "equity"),
  account("4000", "Discount", "Income", "Income", "income"),
  account("4010", "Other Charges", "Income", "Income", "income"),
  account("4020", "Shipping Charge", "Income", "Income", "income"),
  account("4030", "Late Fee Income", "Income", "Income", "income"),
  account("4040", "Interest Income", "Income", "Income", "income"),
  account("4050", "General Income", "Income", "Income", "income"),
  account("4060", "Sales", "Income", "Income", "income", "$1,392.00"),
  account("5000", "Uncategorized", "Expense", "Expenses", "expense"),
  account("5010", "Purchase Discounts", "Expense", "Expenses", "expense"),
  account("5020", "Fuel and mileage expense", "Expense", "Expenses", "expense"),
  account("5030", "Lodging", "Expense", "Expenses", "expense"),
  account("5040", "Parking expense", "Expense", "Expenses", "expense"),
  account("5050", "Other Expenses", "Expense", "Expenses", "expense"),
  account("5060", "Repairs and Maintenance", "Expense", "Expenses", "expense"),
  account("5070", "Rent Expense", "Expense", "Expenses", "expense"),
  account("5080", "Office Supplies", "Expense", "Expenses", "expense"),
  account("5090", "Advertising And Marketing", "Expense", "Expenses", "expense"),
  account("5100", "Bank Fees and Charges", "Expense", "Expenses", "expense"),
  account("5110", "Credit Card Charges", "Expense", "Expenses", "expense"),
  account("5120", "Travel Expense", "Expense", "Expenses", "expense"),
  account("5130", "Telephone Expense", "Expense", "Expenses", "expense"),
  account("5140", "Automobile Expense", "Expense", "Expenses", "expense"),
  account("5150", "IT and Internet Expenses", "Expense", "Expenses", "expense"),
  account("5160", "Consultant Expense", "Expense", "Expenses", "expense"),
  account("5170", "Janitorial Expense", "Expense", "Expenses", "expense"),
  account("5180", "Postage", "Expense", "Expenses", "expense"),
  account("5190", "Bad Debt", "Expense", "Expenses", "expense"),
  account("5200", "Printing and Stationery", "Expense", "Expenses", "expense"),
  account("5210", "Salaries and Employee Wages", "Expense", "Expenses", "expense"),
  account("5220", "Meals and Entertainment", "Expense", "Expenses", "expense"),
  account("5230", "Depreciation Expense", "Expense", "Expenses", "expense"),
  account("6000", "Cost of Goods Sold", "Cost Of Goods Sold", "Cost of Goods Sold", "cogs"),
  account("7000", "Exchange Gain or Loss", "Other Expense", "Other Expenses", "expense"),
].map((entry) => ({ ...entry, transactions: accountTransactions[entry.code] ?? [] }));

function activateOnKeyboard(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
}

function AccountTransactionsDrawer({ account, onClose }: { account: (typeof initialAccounts)[number]; onClose: () => void }) {
  const Icon = account.icon;
  const transactionPagination = useTablePagination(account.transactions, account.code);
  return <div className="chart-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="chart-account-drawer" role="dialog" aria-modal="true" aria-label={`${account.name} transactions`}><header className="chart-drawer-header"><div><span>{account.code} · {account.group}</span><h2>{account.name}</h2><p>{account.type}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close account transactions" title="Close"><X size={18} /></button></header><div className="chart-drawer-body"><section className="chart-account-summary"><span className={account.tone}><Icon size={20} /></span><div><small>Current balance</small><strong>{account.balance}</strong></div><p>{account.transactions.length} recorded transaction{account.transactions.length === 1 ? "" : "s"}</p></section><section className="chart-transactions-card"><div className="chart-transactions-header"><div><h3>Transactions</h3><p>All recorded activity in this account.</p></div></div>{account.transactions.length ? <><div className="finance-table-scroll"><table className="finance-table chart-transactions-table"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{transactionPagination.pageItems.map((transaction) => <tr key={transaction.id}><td>{transaction.date}</td><td><strong>{transaction.reference}</strong></td><td>{transaction.description}</td><td className="chart-transaction-debit">{transaction.debit ? money(transaction.debit) : "-"}</td><td className="chart-transaction-credit">{transaction.credit ? money(transaction.credit) : "-"}</td><td className="chart-transaction-balance">{money(transaction.balance)}</td></tr>)}</tbody></table></div><TablePagination {...transactionPagination} /></> : <div className="chart-empty-transactions"><WalletCards size={22} /><strong>No transactions recorded</strong><p>This account has not received any activity yet.</p></div>}</section></div></aside></div>;
}

export default function ChartOfAccountsPage() {
  const [storedAccounts, setAccounts] = useDemoState(initialAccounts);
  const accounts = storedAccounts.map((item) => ({ ...item, icon: accountIcons[item.tone] }));
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
  const selectedAccount = accounts.find((account) => account.code === selectedAccountCode) ?? null;
  const accountPagination = useTablePagination(accounts, accounts.length);

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const type = String(form.get("type"));
    const group = String(form.get("group"));
    if (!name) return;
    const tone: AccountTone = group === "Assets" ? "asset" : group === "Liabilities" ? "liability" : group === "Equity" ? "equity" : group === "Income" ? "income" : group === "Cost of Goods Sold" ? "cogs" : "expense";
    setAccounts((current) => [...current, { ...account(String(8000 + current.length * 10), name, type, group, tone, "$0.00", String(form.get("description")).trim()), transactions: [] }]);
    setCreatingAccount(false);
  }

  return <div className="chart-accounts-page">
    <header className="chart-accounts-heading"><div><span>Money</span><h2>Chart of accounts</h2><p>The account structure Ora uses to classify every financial transaction.</p></div><button className="primary-button" type="button" onClick={() => setCreatingAccount(true)}><Plus size={16} />Create account</button></header>
    <section className="chart-accounts-card"><div className="chart-accounts-card-header"><div><h3>Account register</h3><p>{accounts.length} active accounts</p></div></div><div className="finance-table-scroll"><table className="finance-table chart-accounts-table"><thead><tr><th>Code</th><th>Account name</th><th>Account type</th><th>Group</th><th>Current balance</th></tr></thead><tbody>{accountPagination.pageItems.map((account) => { const Icon = account.icon; return <tr key={account.code} className="chart-clickable-row" role="button" tabIndex={0} aria-label={`Open ${account.name} transactions`} onClick={() => setSelectedAccountCode(account.code)} onKeyDown={(event) => activateOnKeyboard(event, () => setSelectedAccountCode(account.code))}><td><span className="chart-account-code">{account.code}</span></td><td><span className="chart-account-name"><span className={account.tone}><Icon size={16} /></span><span className="chart-account-label"><strong>{account.name}</strong>{account.description && <small>{account.description}</small>}</span></span></td><td>{account.type}</td><td><span className={`chart-account-group ${account.tone}`}>{account.group}</span></td><td className="chart-account-balance">{account.balance}</td></tr>; })}</tbody></table></div><TablePagination {...accountPagination} /></section>
    {selectedAccount && <AccountTransactionsDrawer account={selectedAccount} onClose={() => setSelectedAccountCode(null)} />}
    {creatingAccount && <Modal title="Create account" subtitle="Add a new account to Ora's chart of accounts." onClose={() => setCreatingAccount(false)}><form className="chart-account-form" onSubmit={createAccount}><label className="field"><span>Account name</span><input name="name" required /></label><label className="field"><span>Account type</span><select name="type" defaultValue="Expense"><option>Bank</option><option>Cash</option><option>Other Current Asset</option><option>Accounts Receivable</option><option>Fixed Asset</option><option>Other Current Liability</option><option>Accounts Payable</option><option>Other Liability</option><option>Equity</option><option>Income</option><option>Expense</option><option>Cost Of Goods Sold</option><option>Other Expense</option><option>Stock</option></select></label><label className="field span-2"><span>Group</span><select name="group" defaultValue="Expenses"><option>Assets</option><option>Liabilities</option><option>Equity</option><option>Income</option><option>Expenses</option><option>Cost of Goods Sold</option><option>Other Expenses</option></select></label><label className="field span-2"><span>Description</span><textarea name="description" rows={3} placeholder="Optional description" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setCreatingAccount(false)}>Cancel</button><button className="primary-button" type="submit">Create account</button></div></form></Modal>}
  </div>;
}
