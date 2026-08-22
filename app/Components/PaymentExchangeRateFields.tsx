"use client";

import type { PaymentCurrency } from "./PaymentDepositFields";

export function paymentAmountInUsd(
  amount: string | number,
  currency: PaymentCurrency,
  exchangeRate: string | number,
) {
  const numericAmount = Number(amount);
  const numericRate = Number(exchangeRate);
  if (!Number.isFinite(numericAmount)) return 0;
  if (currency !== "SYP") return numericAmount;
  return Number.isFinite(numericRate) && numericRate > 0 ? numericAmount / numericRate : 0;
}

export default function PaymentExchangeRateFields({
  amount,
  currency,
  exchangeRate,
  onExchangeRateChange,
}: {
  amount: string | number;
  currency: PaymentCurrency;
  exchangeRate: string;
  onExchangeRateChange: (value: string) => void;
}) {
  const usdAmount = paymentAmountInUsd(amount, currency, exchangeRate);

  return <>
    <input name="usdAmount" type="hidden" value={Number.isFinite(usdAmount) ? usdAmount : 0} readOnly />
    {currency === "SYP" && <div className="payment-exchange-fields">
      <label className="field">
        <span>SYP per US$</span>
        <input name="exchangeRate" type="number" min="0.01" step="0.01" value={exchangeRate} onChange={(event) => onExchangeRateChange(event.target.value)} required />
      </label>
      <div className="payment-exchange-result" aria-live="polite">
        <small>Applied to USD invoice</small>
        <strong>US${usdAmount.toFixed(2)}</strong>
        <span>{Number(amount || 0).toLocaleString("en-US")} SYP collected</span>
      </div>
    </div>}
  </>;
}
