# Ora Frontend Handoff

## What this project is

This is a static, frontend-only Next.js application. It has no API client, database, environment variables, authentication service, browser storage, or server code. All example data is held in memory and resets after a browser refresh.

## Install and build

```bash
npm install
npm run build
```

The production-ready static site is generated in `out/`. The backend can serve that folder directly, or use the source application and its own deployment pipeline.

## Primary frontend data contract

`app/Pages/mock-data.ts` is the source of truth for the current frontend model. Its exported `OraData` interface contains the application workspace and links together:

- doctors and clinics
- staff, roles, permissions, and profile settings
- lab cases, workflow history, service lines, selected teeth, materials, holds, doctor messages, and attachments
- inventory and inventory activity
- payments, expenses, and activity log entries
- delivery tasks and delivery progress
- branding, service catalog, material catalog, and workflow order settings

The same file exports the supporting types: `LabCase`, `Doctor`, `ClinicProfile`, `StaffMember`, `RoleDefinition`, `DeliveryTask`, `Payment`, `Expense`, `Material`, and related nested types. Use these TypeScript interfaces as the initial request/response shapes when designing the API and database schema.

## Integration points to replace

The frontend currently changes temporary local React state through these files:

- `app/Pages/WorkspacePage.tsx`: lab workspace, case, staff, clinic, settings, inventory, delivery, and doctor-account mutations.
- `app/Pages/DoctorPortalPage.tsx`: doctor portal views, doctor requests, conversation, invoices, and delivery tracking.
- `app/Pages/AccountingWorkspacePage.tsx` plus `app/Pages/accounting/`: invoices, payments, banking, payroll, expenses, vendors, and accounting operations.
- `app/Components/useDemoState.ts`: in-memory demo state helper. Replace usages with API query/mutation state.
- `app/Components/accountingLedger.ts`: temporary accounting ledger queue. Replace with persistent accounting transactions.

There are no existing API endpoint names to preserve. The backend developer should define the endpoints and replace the local update callbacks with authenticated API calls.

## Backend decisions still needed

- authentication and session design for admins, input managers, workflow staff, drivers, accountants, and doctors
- role/permission enforcement on the server
- database schema and migrations based on `OraData`
- file storage for doctor uploads, staff photos, and branding image uploads
- QR-case lookup authorization
- audit logging, backups, accounting posting rules, and optional real-time updates

## Assets

All static assets required by the frontend are in `public/`. The Illustrator dental chart is `public/assets/ora-dental-chart.svg` and is loaded by `app/Components/DentalReferenceChart.tsx` using the local `/assets/ora-dental-chart.svg` path.

## Not part of the handoff

Do not include `node_modules/`, `.next/`, `out/`, `.git/`, `.openai/`, `.vinext/`, `.wrangler/`, `ora-data/`, `runtime/`, or any old empty folders. They are dependencies, generated output, tooling caches, or retired prototype artifacts.
