# Ora Frontend

Ora is a frontend-only React/Next.js interface for a dental laboratory. It uses realistic fixture data from `app/Pages/mock-data.ts` and has no API, database, authentication service, browser-storage dependency, or network dependency. Demo changes stay in memory for the current browser session and reset on refresh.

## Structure

```text
app/
|-- Pages/       Workspace page and mock data
|-- Components/  Reusable UI components
|-- Assets/      Static frontend resources
|-- Layouts/     Application layout components
`-- Style/       Shared and interface-specific styles
```

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Use `npm run build` to generate the static frontend in `out/`, and `npm test` for the frontend smoke checks.
