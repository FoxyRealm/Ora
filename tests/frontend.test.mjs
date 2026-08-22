import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");

test("frontend workspace has no API calls", () => {
  const source = fs.readFileSync(path.join(root, "app", "Pages", "WorkspacePage.tsx"), "utf8");
  assert.doesNotMatch(source, /fetch\(|\/api\//);
});

test("frontend module structure is present", () => {
  for (const directory of ["Pages", "Components", "Assets", "Layouts", "Style"]) {
    assert.equal(fs.existsSync(path.join(root, "app", directory)), true, `${directory} directory is missing`);
  }
  assert.equal(fs.existsSync(path.join(root, "app", "Pages", "WorkspacePage.tsx")), true);
  assert.equal(fs.existsSync(path.join(root, "app", "Pages", "mock-data.ts")), true);
});

test("doctor oral scan requests must reach Review before submission", () => {
  const source = fs.readFileSync(
    path.join(root, "app", "Pages", "DoctorPortalPage.tsx"),
    "utf8",
  );

  assert.match(source, /const reviewReached = useRef\(false\)/);
  assert.match(source, /step !== steps\.length - 1 \|\| !reviewReached\.current/);
  assert.match(source, /if \(step === steps\.length - 2\) reviewReached\.current = true/);
  assert.match(source, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(source, /type=\{isCase \? "button" : "submit"\}/);
});

test("doctor oral scan wizard keeps controls reachable while its details scroll", () => {
  const styles = read("app/Style/DoctorPortal.css");
  assert.match(styles, /\.doctor-case-request-modal \{ display: flex; flex-direction: column; overflow: hidden; \}/);
  assert.match(styles, /\.doctor-case-request-modal \.doctor-request-grid \{ min-height: 0; flex: 1; overflow-y: auto;/);
  assert.match(styles, /\.doctor-case-request-modal form > footer \{ flex: 0 0 auto;/);
});

test("pickup trips remain active until the box arrives at the lab", () => {
  const workspace = fs.readFileSync(
    path.join(root, "app", "Pages", "WorkspacePage.tsx"),
    "utf8",
  );
  const dataModel = fs.readFileSync(
    path.join(root, "app", "Pages", "mock-data.ts"),
    "utf8",
  );

  assert.match(dataModel, /"picked_up" \| "received_at_lab"/);
  assert.match(dataModel, /"out" \| "collected" \| "completed"/);
  assert.match(workspace, /deliveryStatus: "received_at_lab"/);
  assert.match(workspace, /status: "collected", collectedAt: now/);
  assert.match(workspace, /Arrived at lab/);
});

test("case payments feed the accounting invoice register", () => {
  const workspace = fs.readFileSync(
    path.join(root, "app", "Pages", "WorkspacePage.tsx"),
    "utf8",
  );
  const accounting = fs.readFileSync(
    path.join(root, "app", "Pages", "AccountingWorkspacePage.tsx"),
    "utf8",
  );

  assert.match(workspace, /method,\s*reference,\s*account,/);
  assert.match(accounting, /function invoicesFromOraData\(data: OraData\)/);
  assert.match(accounting, /\.filter\(\(payment\) => payment\.caseId === labCase\.id\)/);
  assert.match(accounting, /id: `INV-\$\{invoiceNumber\}`/);
});

test("doctor portal desktop navigation can collapse", () => {
  const portal = fs.readFileSync(
    path.join(root, "app", "Pages", "DoctorPortalPage.tsx"),
    "utf8",
  );
  const styles = fs.readFileSync(
    path.join(root, "app", "Style", "DoctorPortal.css"),
    "utf8",
  );

  assert.match(portal, /const \[navigationCollapsed, setNavigationCollapsed\] = useState\(false\)/);
  assert.match(portal, /aria-label=\{navigationCollapsed \? "Expand navigation" : "Collapse navigation"\}/);
  assert.match(styles, /\.doctor-portal-shell\.navigation-collapsed/);
  assert.match(styles, /grid-template-columns: 76px minmax\(0, 1fr\)/);
});

test("accounting modules use working page-specific operations", () => {
  const workspace = read("app/Pages/AccountingWorkspacePage.tsx");
  const operations = read("app/Pages/accounting/FinanceOperationsPage.tsx");
  assert.match(workspace, /<FinanceOperationsPage/);
  assert.doesNotMatch(workspace, /<FinanceModulePage page=/);
  for (const page of ["expenses", "bills", "purchase-orders", "credit-notes", "inventory", "reports"]) {
    assert.match(operations, new RegExp(`page === ["']${page}["']`));
  }
  assert.match(operations, /<SettingsView/);
  assert.match(operations, /useDemoState<OperationsState>/);
  assert.match(operations, /Select a vendor/);
  assert.match(operations, /name="description" placeholder="e\.g\. Zirconia discs and milling supplies"/);
  assert.match(operations, /name="description" placeholder="e\.g\. 15 discs, 98 mm, multilayer shade"/);
});

test("payroll control pages are functional", () => {
  const payroll = read("app/Pages/accounting/PayrollPage.tsx");
  const controls = read("app/Pages/accounting/PayrollControlPages.tsx");
  assert.match(payroll, /useDemoState<Employee\[\]>/);
  assert.match(payroll, /useDemoState<PayrollRun\[\]>/);
  assert.match(payroll, /approved hours and active salaries/);
  assert.match(controls, /Create pay schedule/);
  assert.match(controls, /Deductions & benefits/);
  assert.match(controls, /doc\.save/);
  assert.match(controls, /downloadCsv/);
  assert.doesNotMatch(controls, /is ready in this frontend demo/);
});

test("money movements queue into the banking ledger", () => {
  const operations = read("app/Pages/accounting/FinanceOperationsPage.tsx");
  const workspace = read("app/Pages/AccountingWorkspacePage.tsx");
  const labWorkspace = read("app/Pages/WorkspacePage.tsx");
  const banking = read("app/Pages/accounting/BankingPage.tsx");
  assert.match(operations, /queueLedgerEntry/);
  assert.match(workspace, /posted to banking/);
  assert.match(labWorkspace, /method === "Cash" \? "Undeposited Funds" : "In Bank Account"/);
  assert.match(labWorkspace, /id: `ledger-\$\{paymentId\}`/);
  assert.match(labWorkspace, /direction: amount > 0 \? "in" : "out"/);
  assert.match(banking, /takeQueuedLedgerEntries/);
  assert.match(banking, /Sync case payments/);
});

test("invoice payments use the detailed received-payment form and preserve payment details", () => {
  const accounting = read("app/Pages/AccountingWorkspacePage.tsx");
  const depositFields = read("app/Components/PaymentDepositFields.tsx");
  assert.match(accounting, /finance-payment-modal-form/);
  assert.match(accounting, /Invoice and amount/);
  assert.match(accounting, /Payment details/);
  assert.match(accounting, /PaymentDepositFields/);
  assert.match(depositFields, /name="account"/);
  assert.match(accounting, /const date = String\(form\.get\("date"\)\)/);
  assert.match(accounting, /const note = String\(form\.get\("note"\)\)/);
});

test("banking can create additional bank accounts", () => {
  const banking = read("app/Pages/accounting/BankingPage.tsx");
  assert.match(banking, /function NewBankAccountModal/);
  assert.match(banking, /Add bank account/);
  assert.match(banking, /function createBankAccount/);
  assert.match(banking, /setLedgerAccounts\(\(current\) => \[\.\.\.current,/);
  assert.match(banking, /Opening balance entered while creating this bank account/);
});

test("accounting supports base currency, manual rates, and bank account currencies", () => {
  const currency = read("app/Components/accountingCurrency.ts");
  const operations = read("app/Pages/accounting/FinanceOperationsPage.tsx");
  const workspace = read("app/Pages/AccountingWorkspacePage.tsx");
  const banking = read("app/Pages/accounting/BankingPage.tsx");
  assert.match(currency, /ACCOUNTING_CURRENCIES/);
  assert.match(currency, /convertCurrency/);
  assert.match(operations, /Multi-currency/);
  assert.match(operations, /Base reporting currency/);
  assert.match(workspace, /useDemoState<CurrencySettings>/);
  assert.match(banking, /Account currency/);
  assert.match(banking, /currency: account\.currency \?\? "USD"/);
});

test("frontend state has no browser-storage dependency", () => {
  const stateHook = read("app/Components/useDemoState.ts");
  const workspace = read("app/Pages/WorkspacePage.tsx");
  const ledger = read("app/Components/accountingLedger.ts");
  assert.doesNotMatch(stateHook, /localStorage|sessionStorage/);
  assert.doesNotMatch(workspace, /localStorage|sessionStorage/);
  assert.doesNotMatch(ledger, /localStorage|sessionStorage/);
});

test("handoff keeps the shared UI improvements without the abandoned Arabic experiment", () => {
  const settingsStyles = read("app/Style/Settings.css");
  const finance = read("app/Pages/AccountingWorkspacePage.tsx");
  const financeStyles = read("app/Style/AccountingWorkspace.css");
  const doctorStyles = read("app/Style/DoctorPortal.css");
  const workspace = read("app/Pages/WorkspacePage.tsx");
  const config = read("next.config.ts");
  assert.match(settingsStyles, /\.workflow-settings-columns/);
  assert.match(settingsStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(finance, /finance-mobile-navigation/);
  assert.match(financeStyles, /\.finance-mobile-navigation\s*\{\s*display:\s*grid/);
  assert.match(doctorStyles, /doctor-delivery-status\.out-for-delivery/);
  assert.doesNotMatch(workspace, /CasesLanguage|CASES_AR|dir="auto"/);
  assert.match(config, /output: "export"/);
});

test("Illustrator dental chart preserves exact tooth selection and printing", () => {
  const chart = read("app/Components/DentalReferenceChart.tsx");
  const workspace = read("app/Pages/WorkspacePage.tsx");
  const doctorPortal = read("app/Pages/DoctorPortalPage.tsx");
  const svg = read("public/assets/ora-dental-chart.svg");
  const toothLayers = [...svg.matchAll(/<g id="_([1-4][1-8])" data-name="\1">/g)];

  assert.equal(toothLayers.length, 32);
  assert.match(chart, /const DENTAL_CHART_URL = "\/assets\/ora-dental-chart\.svg"/);
  assert.match(chart, /data-tooth="\$\{tooth\}" class="ora-tooth\$\{selectedClass\}"/);
  assert.match(chart, /ora-selected-label/);
  assert.match(chart, /aria-pressed="\$\{selected\.has\(tooth\)\}"/);
  assert.match(chart, /const CONNECTOR_PAIRS = \[/);
  assert.match(chart, /const TOOTH_CENTERS: Record<string, ToothCenter> = \{/);
  assert.match(chart, /aria-label=\{`Connect teeth \$\{connector\.first\} and \$\{connector\.second\}`\}/);
  assert.match(chart, /function printConnectorMarkup\(selectedTeeth: string\[\], toothConnections: string\[\]\)/);
  assert.match(workspace, /dentalChartPrintMarkup\(\s*labCase\.teeth \?\? \[\],\s*labCase\.toothConnections \?\? \[\]/);
  assert.match(workspace, /width:min\(100%,56mm\);aspect-ratio:342\/671/);
  assert.match(doctorPortal, /<DentalReferenceChart[\s\S]*selectedTeeth=\{selectedTeeth\}/);
  assert.match(doctorPortal, /fields\.toothConnections = JSON\.stringify\(toothConnections\)/);
  assert.match(doctorPortal, /teeth,\s*toothConnections,/);
});

test("invoice acceptance and QR destinations are explicit", () => {
  const workspace = read("app/Pages/WorkspacePage.tsx");
  const portal = read("app/Pages/DoctorPortalPage.tsx");
  const accounting = read("app/Pages/AccountingWorkspacePage.tsx");

  assert.match(portal, /function acceptInvoices\(caseIds: string\[\]\)/);
  assert.match(portal, /Accept selected/);
  assert.match(portal, /Accept invoice/);
  assert.match(workspace, /caseQrUrl\(selectedCase\.id, "job-order"\)/);
  assert.match(workspace, /caseQrUrl\(selectedCase\.id, "sticker"\)/);
  assert.match(workspace, /target\.destination === "delivery"/);
  assert.match(workspace, /Invoice accepted by doctor/);
  assert.match(accounting, /doctorAcceptedAt: labCase\.invoiceAcceptedAt/);
});
