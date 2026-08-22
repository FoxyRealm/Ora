"use client";

import { useEffect, useMemo } from "react";
import useDemoState from "./useDemoState";

export type PaymentCurrency = "USD" | "SYP";

type DepositAccount = {
  name: string;
  currency?: string;
};

const fallbackAccounts: DepositAccount[] = [
  { name: "Petty Cash", currency: "USD" },
  { name: "Undeposited Funds", currency: "USD" },
  { name: "In Bank Account", currency: "USD" },
];

const defaultUsdAccounts = new Set(fallbackAccounts.map((account) => account.name));

function paymentCurrencyForAccount(account: DepositAccount): PaymentCurrency | null {
  const storedCurrency = account.currency?.trim().toUpperCase();
  if (storedCurrency === "SYP") return "SYP";
  if (storedCurrency === "USD" || storedCurrency === "US$") return "USD";
  return defaultUsdAccounts.has(account.name) ? "USD" : null;
}

export default function PaymentDepositFields({
  account,
  currency,
  onAccountChange,
  onCurrencyChange,
}: {
  account: string;
  currency: PaymentCurrency;
  onAccountChange: (account: string) => void;
  onCurrencyChange: (currency: PaymentCurrency) => void;
}) {
  const [accounts] = useDemoState<DepositAccount[]>(fallbackAccounts);
  const availableAccounts = useMemo(
    () => accounts.filter((item) => paymentCurrencyForAccount(item) === currency),
    [accounts, currency],
  );

  useEffect(() => {
    if (availableAccounts.some((item) => item.name === account)) return;
    onAccountChange(availableAccounts[0]?.name ?? "");
  }, [account, availableAccounts, onAccountChange]);

  return (
    <div className="payment-deposit-fields">
      <label className="field">
        <span>Deposit to</span>
        <select
          name="account"
          value={account}
          onChange={(event) => onAccountChange(event.target.value)}
          required
        >
          {!availableAccounts.length && <option value="">No {currency} account available</option>}
          {availableAccounts.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} · {currency === "USD" ? "US$" : "SYP"}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Currency</span>
        <select
          name="currency"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value as PaymentCurrency)}
        >
          <option value="USD">US$</option>
          <option value="SYP">SYP (S£)</option>
        </select>
      </label>
    </div>
  );
}
