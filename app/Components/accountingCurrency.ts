export const ACCOUNTING_CURRENCIES = ["USD", "EUR", "SYP"] as const;

export type AccountingCurrency = (typeof ACCOUNTING_CURRENCIES)[number];

export type CurrencySettings = {
  baseCurrency: AccountingCurrency;
  /** Value of one unit of the selected currency in USD. */
  ratesToUsd: Record<AccountingCurrency, number>;
  updatedAt: string;
};

export const defaultCurrencySettings: CurrencySettings = {
  baseCurrency: "USD",
  ratesToUsd: {
    USD: 1,
    EUR: 1.09,
    SYP: 0.000077,
  },
  updatedAt: "2026-08-15",
};

export const currencyLabel = (currency: AccountingCurrency) => ({
  USD: "US Dollar (USD)",
  EUR: "Euro (EUR)",
  SYP: "Syrian Pound (SYP)",
})[currency];

export function formatCurrency(value: number, currency: AccountingCurrency | string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "SYP" ? 0 : 2,
  }).format(value);
}

export function convertCurrency(value: number, from: AccountingCurrency, to: AccountingCurrency, settings: CurrencySettings) {
  if (from === to) return value;
  const valueInUsd = value * settings.ratesToUsd[from];
  return valueInUsd / settings.ratesToUsd[to];
}
