export type PrintableInvoice = {
  number: string;
  status: string;
  brandTitle: string;
  brandSubtitle: string;
  doctor: string;
  clinic: string;
  patient: string;
  issued: string;
  caseNumber: string;
  services: Array<{ service: string; shade: string; units: string; unitPrice: string; amount: string }>;
  payments: Array<{ date: string; label: string; amount: string; negative?: boolean }>;
  total: string;
  paid: string;
  balance: string;
};

function escapePrintHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function printInvoicePages(invoices: PrintableInvoice[]) {
  if (!invoices.length) return false;
  const popup = window.open("", "_blank", "width=900,height=900");
  if (!popup) return false;
  const pages = invoices.map((invoice) => {
    const services = invoice.services.map((line) => `<tr><td><strong>${escapePrintHtml(line.service)}</strong><small>Shade: ${escapePrintHtml(line.shade || "Not recorded")}</small></td><td class="num">${escapePrintHtml(line.units)}</td><td class="num">${escapePrintHtml(line.unitPrice)}</td><td class="num"><strong>${escapePrintHtml(line.amount)}</strong></td></tr>`).join("");
    const payments = invoice.payments.length
      ? invoice.payments.map((payment) => `<tr><td>${escapePrintHtml(payment.date)}</td><td>${escapePrintHtml(payment.label)}</td><td class="num ${payment.negative ? "negative" : "positive"}">${payment.negative ? "-" : "+"}${escapePrintHtml(payment.amount)}</td></tr>`).join("")
      : '<tr><td colspan="3" class="empty">No payments recorded</td></tr>';
    return `<main class="invoice-page"><header class="invoice-head"><div class="brand">${escapePrintHtml(invoice.brandTitle)}<small>${escapePrintHtml(invoice.brandSubtitle)}</small></div><div class="invoice-title"><small>Invoice</small><h1>${escapePrintHtml(invoice.number)}</h1><span class="status ${escapePrintHtml(invoice.status.toLowerCase())}">${escapePrintHtml(invoice.status)}</span></div></header><section class="invoice-meta"><div><small>Doctor</small><strong>${escapePrintHtml(invoice.doctor)}</strong><span>${escapePrintHtml(invoice.clinic)}</span></div><div><small>Patient</small><strong>${escapePrintHtml(invoice.patient)}</strong></div><div><small>Issued</small><strong>${escapePrintHtml(invoice.issued)}</strong></div><div><small>Case</small><strong>${escapePrintHtml(invoice.caseNumber)}</strong></div></section><table class="service-table"><thead><tr><th>Service</th><th class="num">Units</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${services}</tbody></table><section class="invoice-bottom"><div class="payment-history"><h2>Payment history</h2><table><tbody>${payments}</tbody></table></div><div class="totals"><div><span>Invoice total</span><strong>${escapePrintHtml(invoice.total)}</strong></div><div><span>Paid</span><strong>${escapePrintHtml(invoice.paid)}</strong></div><div class="balance"><span>Balance due</span><strong>${escapePrintHtml(invoice.balance)}</strong></div></div></section></main>`;
  }).join("");
  popup.document.write(`<!doctype html><html><head><title>${invoices.length === 1 ? escapePrintHtml(invoices[0].number) : `${invoices.length} Ora invoices`}</title><style>*{box-sizing:border-box}body{margin:0;background:#edf2f0;color:#17211f;font-family:Arial,sans-serif;font-size:12px}.invoice-page{width:210mm;min-height:297mm;margin:12px auto;padding:18mm;background:#fff;box-shadow:0 4px 18px rgba(20,55,49,.12);page-break-after:always}.invoice-page:last-child{page-break-after:auto}.invoice-head{display:flex;align-items:flex-start;justify-content:space-between;gap:30px;padding-bottom:20px;border-bottom:2px solid #15695f}.brand{color:#15695f;font-size:28px;font-weight:800}.brand small{display:block;margin-top:4px;color:#65726f;font-size:9px;letter-spacing:1px;text-transform:uppercase}.invoice-title{text-align:right}.invoice-title>small{color:#65726f;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.invoice-title h1{margin:4px 0 8px;font-size:22px}.status{display:inline-block;padding:4px 8px;border-radius:12px;background:#edf1f0;color:#5b6d69;font-size:9px;font-weight:800;text-transform:uppercase}.status.paid{background:#e4f4ec;color:#17653f}.status.partial{background:#fff2df;color:#9a5d1d}.status.overdue{background:#fce9e7;color:#a63d35}.invoice-meta{display:grid;grid-template-columns:1.4fr 1.2fr .8fr .6fr;gap:8px;margin:20px 0}.invoice-meta>div{min-height:64px;padding:11px;border:1px solid #dce5e2;background:#f8fbfa}.invoice-meta small,.invoice-meta strong,.invoice-meta span{display:block}.invoice-meta small{color:#65726f;font-size:8px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}.invoice-meta strong{margin-top:5px;font-size:12px}.invoice-meta span{margin-top:3px;color:#6e7d7a;font-size:9px}table{width:100%;border-collapse:collapse}.service-table{margin-top:10px}.service-table th{padding:9px;background:#edf4f2;color:#4e625e;font-size:9px;text-align:left;text-transform:uppercase}.service-table td{padding:11px 9px;border-bottom:1px solid #dde7e4}.service-table td small{display:block;margin-top:4px;color:#6e7d7a;font-size:9px}.num{text-align:right!important}.invoice-bottom{display:grid;grid-template-columns:minmax(0,1fr) 245px;gap:32px;margin-top:26px}.payment-history h2{margin:0 0 8px;font-size:12px}.payment-history td{padding:7px 5px;border-bottom:1px solid #e3eae8;color:#52645f;font-size:9px}.payment-history .empty{text-align:center}.positive{color:#176d60!important}.negative{color:#a63d35!important}.totals>div{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #dce5e2}.totals .balance{margin-top:4px;padding-top:11px;border-top:2px solid #17211f;border-bottom:0;color:#155f57;font-size:15px}@media print{body{background:#fff}.invoice-page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}@page{size:A4 portrait;margin:16mm}}</style></head><body>${pages}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  popup.document.close();
  return true;
}
